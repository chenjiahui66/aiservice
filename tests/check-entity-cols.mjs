/**
 * 实体字段 ↔ 真实数据库列 双向校验
 * 目的：在写业务代码之前就把「实体有而表没有」「表有而实体没有」两类问题挑出来。
 *      幽灵列会在运行时表现为 Unknown column，而漏列会静默丢数据，更难发现。
 *
 * 用法：node D:\tmp\agent-scripts\check-entity-cols.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ENTITY_DIR = 'D:/project/MVPdemo/aiservice/backend/src/main/java/com/neighborhood/service/entity';
const DB = process.env.DB_NAME || 'neighborhood';
// 凭据从环境变量读取；与 deploy\.env 保持一致
const DB_USER = process.env.DB_USERNAME;
const DB_PASS = process.env.DB_PASSWORD;
if (!DB_USER || !DB_PASS) {
  console.error('未设置 DB_USERNAME / DB_PASSWORD。');
  console.error('请先 copy deploy\\.env.example deploy\\.env 并填入真实值，然后在同一 shell 中导出。');
  process.exit(1);
}
const MYSQL = ['-u', DB_USER, `-p${DB_PASS}`, '--default-character-set=utf8mb4', '-N', '-B', '-e'];

function q(sql) {
  return execFileSync('mysql', [...MYSQL, sql], { encoding: 'utf8' }).trim();
}

// ---------- 1. 真实表列 ----------
const tables = q(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DB}';`)
  .split('\n').map(s => s.trim()).filter(Boolean);

const dbCols = {};
for (const t of tables) {
  dbCols[t] = q(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${DB}' AND TABLE_NAME='${t}';`)
    .split('\n').map(s => s.trim()).filter(Boolean);
}

// ---------- 2. 实体声明的列 ----------
const JAVA_TO_SNAKE = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

function parseEntity(file) {
  const src = fs.readFileSync(file, 'utf8');
  const table = src.match(/@TableName\("([^"]+)"\)/)?.[1];
  if (!table) return null;

  // 形如: @TableField("col") / @TableField(value="col", fill=..) / @TableId(value="id"...)
  const cols = new Set();
  const idMatch = src.match(/@TableId\(value\s*=\s*"([^"]+)"/);
  if (idMatch) cols.add(idMatch[1]);
  for (const m of src.matchAll(/@TableField\(\s*(?:value\s*=\s*)?"([^"]+)"/g)) {
    cols.add(m[1]);
  }
  // 兜底：无注解的字段按驼峰转下划线（当前生成器每个字段都有注解，理论上不会走到）
  for (const m of src.matchAll(/private\s+[\w<>,. ]+\s+(\w+);/g)) {
    cols.add(JAVA_TO_SNAKE(m[1]));
  }
  return { table, cols: [...cols] };
}

let problems = 0;
for (const file of fs.readdirSync(ENTITY_DIR).filter(f => f.endsWith('.java'))) {
  const parsed = parseEntity(path.join(ENTITY_DIR, file));
  if (!parsed) { console.log(`⚠️  ${file}: 缺少 @TableName，跳过`); problems++; continue; }

  const actual = dbCols[parsed.table];
  if (!actual) {
    console.log(`❌ ${parsed.table}: 实体存在但数据库没有这张表`);
    problems++;
    continue;
  }

  const ghost = parsed.cols.filter(c => !actual.includes(c));          // 幽灵列：实体有、表没有
  const missing = actual.filter(c => !parsed.cols.includes(c));        // 漏列：表有、实体没有
  const extra = actual.filter(c => !['created_at', 'updated_at', 'deleted'].includes(c)
    && !parsed.cols.includes(c));

  if (ghost.length) { console.log(`❌ ${parsed.table} 幽灵列(实体有表没有): ${ghost.join(', ')}`); problems++; }
  if (missing.length) { console.log(`❌ ${parsed.table} 实体缺列(表有实体没有): ${missing.join(', ')}`); problems++; }
  if (!ghost.length && !missing.length && !extra.length) {
    console.log(`✅ ${parsed.table}  ${parsed.cols.length} 列完全一致`);
  }
}

// ---------- 3. 反查：有没有表没有实体 ----------
const entityTables = fs.readdirSync(ENTITY_DIR)
  .map(f => parseEntity(path.join(ENTITY_DIR, f))?.table).filter(Boolean);
const noEntity = tables.filter(t => !entityTables.includes(t));
if (noEntity.length) console.log(`ℹ️  无对应实体的表: ${noEntity.join(', ')}`);

console.log(problems ? `\n发现 ${problems} 个实体/表结构问题` : '\n全部实体与表结构一致');
process.exit(problems ? 1 : 0);