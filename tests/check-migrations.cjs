const fs = require('node:fs');
const path = require('node:path');

/**
 * 数据库迁移机制检查。
 *
 * 背景：sql/schema.sql 挂在 MySQL 容器的 docker-entrypoint-initdb.d 下，
 * **只在数据卷首次初始化时执行一次**。已经部署过的环境不会再跑它 ——
 * 之后新增的表和列如果只改了 schema.sql，功能上线即报表不存在，
 * 而且现场很难查（表没建 vs 代码写错，症状都是 500）。
 *
 * 所以「改表」必须走 deploy/migrations/ + deploy/migrate.sh。
 * 这个脚本守住这条规则，并保证 schema.sql 与迁移脚本不会各写各的。
 *
 * 纯 Node 实现，不需要 Docker 引擎，本地就能跑。
 */

const REPO = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(REPO, 'deploy', 'migrations');
const MIGRATE_SH = path.join(REPO, 'deploy', 'migrate.sh');
const DEPLOY_SH = path.join(REPO, 'deploy', 'deploy.sh');
const SCHEMA_SQL = path.join(REPO, 'sql', 'schema.sql');

let fail = 0;
const ok = (c, m) => { console.log((c ? '  [OK] ' : '  [!!] ') + m); if (!c) fail++; };

console.log('=== 数据库迁移检查 ===\n');

console.log('[1] 迁移机制存在性');
ok(fs.existsSync(MIGRATE_SH), 'deploy/migrate.sh 存在');
ok(fs.existsSync(MIGRATIONS_DIR), 'deploy/migrations/ 目录存在');
ok(fs.existsSync(SCHEMA_SQL), 'sql/schema.sql 存在');

const deploySh = fs.existsSync(DEPLOY_SH) ? fs.readFileSync(DEPLOY_SH, 'utf8') : '';
ok(/migrate\.sh/.test(deploySh), 'deploy.sh 调用了 migrate.sh（否则迁移永远不执行）');
ok(/up -d mysql/.test(deploySh), 'deploy.sh 先单独拉起 mysql（迁移要在库可连之后）');

const files = fs.existsSync(MIGRATIONS_DIR)
  ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  : [];
ok(files.length > 0, `迁移脚本 ${files.length} 个`);
files.forEach((f) => console.log(`         ${f}`));

console.log('\n[2] 迁移脚本安全性');
for (const f of files) {
  const t = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
  const dangerous = [
    [/\bDROP\s+DATABASE\b/i, 'DROP DATABASE'],
    [/\bDROP\s+TABLE\b/i, 'DROP TABLE'],
    [/\bTRUNCATE\b/i, 'TRUNCATE'],
    [/\bDELETE\s+FROM\b/i, 'DELETE FROM']
  ].filter(([re]) => re.test(t));
  ok(dangerous.length === 0,
    `${f} 无破坏性语句${dangerous.length ? '：' + dangerous.map((d) => d[1]).join(', ') : ''}`);
}

/**
 * 抽出 CREATE TABLE 块里的列名。
 * 只认 `CREATE TABLE IF NOT EXISTS`（或 CREATE TABLE）开头的块。
 */
function parseTables(sql) {
  const tables = new Map();
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const name = m[1];
    // 从左括号开始逐字符找配对的右括号（跳过字符串里的括号）
    let depth = 0;
    let i = m.index + m[0].length - 1;
    let body = '';
    for (; i < sql.length; i++) {
      const ch = sql[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) { body = sql.slice(m.index + m[0].length, i); break; }
      }
    }
    const cols = new Set();
    for (const line of body.split(/\r?\n/)) {
      const cm = line.match(/^\s*`(\w+)`\s+[A-Z]/i);
      if (cm) cols.add(cm[1]);
    }
    tables.set(name.toLowerCase(), cols);
  }
  return tables;
}

const schemaTables = fs.existsSync(SCHEMA_SQL)
  ? parseTables(fs.readFileSync(SCHEMA_SQL, 'utf8'))
  : new Map();

console.log('\n[3] schema.sql 与迁移脚本的表结构一致');
for (const f of files) {
  const t = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
  const migTables = parseTables(t);
  for (const [name, migCols] of migTables) {
    if (!schemaTables.has(name)) {
      ok(false, `${f} 里的表 ${name} 在 schema.sql 中不存在（新表必须同时写进 schema.sql）`);
      continue;
    }
    const schemaCols = schemaTables.get(name);
    // 迁移脚本里有的列，schema.sql 里也必须有
    const missing = [...migCols].filter((c) => !schemaCols.has(c));
    ok(missing.length === 0,
      `表 ${name} 的列与 schema.sql 一致${missing.length ? '，迁移多出：' + missing.join(', ') : ''}`);
  }
}

console.log('\n[4] 存量环境加列的幂等写法');
for (const f of files) {
  const t = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
  const alters = (t.match(/ALTER\s+TABLE/gi) || []).length;
  if (alters === 0) continue;
  // MySQL 8.0 不支持 ADD COLUMN IF NOT EXISTS，必须走 information_schema + 动态 SQL
  const usesDynamic = /information_schema\.COLUMNS/i.test(t) && /PREPARE\s+\w+\s+FROM/i.test(t);
  ok(usesDynamic,
    `${f} 的 ALTER 走 information_schema + 动态 SQL（MySQL 8.0 没有 ADD COLUMN IF NOT EXISTS）`);
}

console.log();
console.log(fail === 0 ? '[PASS] 数据库迁移检查通过' : `[FAIL] ${fail} 项未通过`);
process.exit(fail === 0 ? 0 : 1);
