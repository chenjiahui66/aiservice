const fs = require('node:fs');
const path = require('node:path');

/**
 * 中文编码回归检查。
 *
 * 背景：本项目踩过一次双重编码的坑 —— MySQL 字符集名里 `utf8` 和 `utf8mb3`
 * 是两个不同的索引，小写 `utf8` 落到 utf8mb3，与表的 utf8mb4 不匹配，
 * 中文被降级成单字节 latin1 解读，存进去就是 `ä¸œé—¨ä»£æ‰"åžƒåœ¾`。
 *
 * 这类问题在配置文件里几乎看不出来（characterEncoding=utf8 看上去完全正常），
 * 只有真正跑起来才炸，所以在这里做成静态断言。
 */

const ROOT = path.resolve(__dirname, '..');
let fail = 0;
const ok = (c, m) => { console.log((c ? '  [OK] ' : '  [!!] ') + m); if (!c) fail++; };

/** 双重编码的典型特征：UTF-8 被当 latin1 读后的西欧字符串 */
const MOJIBAKE = /[\u00c0-\u00ff]{2,}/;
/** GBK 被当 UTF-8 读的特征（Dockerfile 注释曾出现过） */
const GBK_MOJIBAKE = /[\u4e00-\u9fff]{1}[\u0080-\u00bf]/;

console.log('=== 中文编码检查 ===\n');

// ---------------------------------------------------------------- 1. JDBC 字符集
console.log('[1] JDBC 连接串');
const ymlFiles = [
  'backend/src/main/resources/application-prod.yml',
  'backend/src/main/resources/application-dev.yml'
];
for (const rel of ymlFiles) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { ok(false, `${rel} 不存在`); continue; }
  const t = fs.readFileSync(p, 'utf8');
  const line = (t.match(/url:\s*jdbc:mysql:.*/g) || []).join('\n');

  // 小写 utf8（不含 mb3/mb4）会落到 utf8mb3，必须不存在
  ok(!/characterEncoding=utf8(?!mb)/i.test(line) || /characterEncoding=UTF-8/i.test(line),
     `${rel} 未使用会降级到 utf8mb3 的小写 utf8`);

  ok(/characterEncoding=UTF-8/i.test(line),
     `${rel} characterEncoding 为大写 UTF-8`);

  ok(/connectionCollation=utf8mb4/i.test(line),
     `${rel} 显式声明 utf8mb4 的 connectionCollation`);
}
console.log();

// ---------------------------------------------------------------- 2. 源码编码声明
console.log('[2] 构建编码');
const pom = path.join(ROOT, 'backend/pom.xml');
if (fs.existsSync(pom)) {
  const t = fs.readFileSync(pom, 'utf8');
  ok(/<project\.build\.sourceEncoding>\s*UTF-8\s*<\/project\.build\.sourceEncoding>/.test(t),
     'pom.xml 锁定 project.build.sourceEncoding=UTF-8');
  ok(/<encoding>\s*UTF-8\s*<\/encoding>/.test(t),
     'maven-compiler-plugin 锁定 encoding=UTF-8');
} else {
  ok(false, 'backend/pom.xml 不存在');
}
console.log();

// ---------------------------------------------------------------- 3. 容器 locale
console.log('[3] 容器运行时编码');
const df = path.join(ROOT, 'backend/Dockerfile.prebuilt');
if (fs.existsSync(df)) {
  const t = fs.readFileSync(df, 'utf8');
  ok(/-Dfile\.encoding=UTF-8/.test(t), 'Dockerfile.prebuilt 指定 -Dfile.encoding=UTF-8');
  ok(!MOJIBAKE.test(t), 'Dockerfile.prebuilt 注释无双���编码');
  ok(!/\?\?/.test(t), 'Dockerfile.prebuilt 注释无损坏字符');
} else {
  ok(false, 'backend/Dockerfile.prebuilt 不存在');
}
console.log();

// ---------------------------------------------------------------- 4. SQL 文件
console.log('[4] SQL 文件');
for (const rel of ['sql/schema.sql', 'sql/seed.sql']) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { ok(false, `${rel} 不存在`); continue; }
  const raw = fs.readFileSync(p);
  const t = raw.toString('utf8');
  const name = path.basename(rel);

  ok(!(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf),
     `${name} 无 BOM（BOM 会让 mysql 客户端把首行当命令解析失败）`);

  // 若文件本身已被双重编码，重编码一次会得到真正的中文
  let reencoded = t;
  try {
    reencoded = Buffer.from(t, 'latin1').toString('utf8');
  } catch { /* 忽略 */ }
  ok(!MOJIBAKE.test(t) || /[\u4e00-\u9fff]/.test(reencoded),
     `${name} 内容未双重编码`);
  ok(GBK_MOJIBAKE.test(t) === false || /[\u4e00-\u9fff]{4,}/.test(t),
     `${name} 无 GBK/UTF-8 混淆`);
}
console.log();

// ---------------------------------------------------------------- 5. SQL 建表字符集
console.log('[5] 建表字符集');
const schema = path.join(ROOT, 'sql/schema.sql');
if (fs.existsSync(schema)) {
  const t = fs.readFileSync(schema, 'utf8');
  const creates = t.match(/CREATE TABLE[^;]*;/g) || [];
  const utf8mb3 = creates.filter(x => /CHARSET=utf8\b|COLLATE=utf8_(general|unicode|bin|tolower)_ci/i.test(x));
  ok(utf8mb3.length === 0,
     `所有 ${creates.length} 张表都用 utf8mb4${utf8mb3.length ? '，发现 ' + utf8mb3.length + ' 张表用了 utf8mb3' : ''}`);
}
console.log();

console.log(fail === 0 ? '[PASS] 中文编码检查通过' : `[FAIL] ${fail} 项未通过`);
process.exit(fail === 0 ? 0 : 1);