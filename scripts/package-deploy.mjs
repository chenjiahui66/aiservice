/**
 * 打包部署产物 -> nbservice-deploy.tar.gz
 *
 * 用法：
 *   node scripts\package-deploy.mjs
 *   或（Windows 双击） scripts\package-deploy.cmd
 *
 * 产物： <仓库根>\nbservice-deploy.tar.gz
 *
 * 包含：
 *   backend/target/neighborhood-backend.jar   预构建 jar（服务器不编译）
 *   backend/Dockerfile.prebuilt               无编译阶段的镜像定义
 *   admin-web/dist                             后台静态产物
 *   deploy/                                    compose + nginx + deploy.sh
 *   sql/  docs/  README.md
 *
 * 不含：
 *   deploy/.env（含密钥，gitignore 了，也绝不能进包）
 *   backend/src、miniapp/、node_modules/
 *
 * ── 为什么必须用 tar 而不是 PowerShell 的 Compress-Archive ──────────────
 * Compress-Archive 在 Windows 上生成的 zip 条目用 **反斜杠** 做路径分隔符
 * （admin-web\dist\index.html）。Linux 上 `unzip` 解开后，这些条目会变成
 * 单个名为 "admin-web\dist\index.html" 的畸形文件，nginx 找不到 index.html，
 * 而且报错信息完全不指向真实原因。
 * tar/libarchive 统一使用正斜杠，跨平台安全。
 * ───────────────────────────────────────────────────────────────────────
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * 直接读 jar（zip）里的 .class 字节，检查关键标记是否存在。
 *
 * <p>用途：确认「打出来的这个包」真的带着新功能的接口。
 * 这不是锦上添花 —— 线上事故的根因就是传了个旧包，而旧包的表现是
 * 接口 404 被报成「系统繁忙」，靠看返回码根本分辨不出来。</p>
 */
function verifyJarEntries(jarPath, markers) {
  const buf = fs.readFileSync(jarPath);
  const missing = [];

  // 定位 zip 中央目录
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return { ok: false, missing: ['jar 不是有效的 zip'], buildTime: '' };

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    entries.set(buf.toString('utf8', p + 46, p + 46 + nameLen), { method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }

  const read = (name) => {
    const e = entries.get(name);
    if (!e) return null;
    const lo = e.localOffset;
    const dataStart = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28);
    const raw = buf.subarray(dataStart, dataStart + e.compSize);
    try {
      return e.method === 0 ? raw : zlib.inflateRawSync(raw);
    } catch {
      return null;
    }
  };

  for (const [entry, needles] of markers) {
    const data = read(entry);
    if (!data) {
      missing.push(`${entry}（类不存在）`);
      continue;
    }
    const text = data.toString('latin1');
    for (const n of needles) {
      if (!text.includes(n)) missing.push(`${entry.split('/').pop()} → ${n}`);
    }
  }

  // 从 jar 里的 build-info.properties 取构建时间
  let buildTime = '';
  const bi = read('META-INF/build-info.properties');
  if (bi) {
    const m = bi.toString('utf8').match(/buildTime=([^\r\n]+)/);
    if (m) buildTime = m[1];
  }

  return { ok: missing.length === 0, missing, buildTime };
}

// 仓库根 = 本脚本所在目录的上一级
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'nbservice-deploy.tar.gz');
const STAGE = path.join(fs.realpathSync(os.tmpdir()), 'nbservice-package');

// ── 前置检查 ────────────────────────────────────────────────────────────
const mustExist = [
  ['后端 jar', 'backend/target/neighborhood-backend.jar'],
  ['预构建 Dockerfile', 'backend/Dockerfile.prebuilt'],
  ['后台产物', 'admin-web/dist/index.html'],
  ['部署脚本', 'deploy/deploy.sh'],
  ['镜像预拉取脚本', 'deploy/pull-images.sh'],
  ['生产编排', 'deploy/docker-compose.prod.yml'],
  ['网关 nginx 配置（完整）', 'deploy/nginx/community-gateway.conf'],
  ['网关 nginx 配置（仅 HTTP）', 'deploy/nginx/community-gateway-http.conf'],
  ['容器内 nginx 配置', 'deploy/nginx/community-internal.conf'],
  ['环境变量样例', 'deploy/.env.example'],
  ['建表脚本', 'sql/schema.sql'],
  ['数据库迁移脚本', 'deploy/migrate.sh'],
];

console.log('[1/5] 前置检查');
let missing = 0;
for (const [label, rel] of mustExist) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    console.error(`  [缺失] ${label}: ${rel}`);
    missing++;
  }
}
if (missing) {
  console.error('\n产物不全，先补齐后再打包：');
  if (!fs.existsSync(path.join(ROOT, 'backend/target/neighborhood-backend.jar')))
    console.error('  cd backend   && mvn -DskipTests package');
  if (!fs.existsSync(path.join(ROOT, 'admin-web/dist/index.html')))
    console.error('  cd admin-web && npm run build');
  process.exit(1);
}
console.log(`  ${mustExist.length} 项产物全部就绪`);

// ── 收集 ────────────────────────────────────────────────────────────────
console.log('[2/5] 清理暂存');
if (fs.existsSync(STAGE)) fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

console.log('[3/5] 收集文件');

function copyDir(src, dest, filter) {
  if (!fs.existsSync(src)) return 0;
  // ⚠️ 必须先建目标目录：否则顶层文件（路径不带子目录前缀时）会写到
  //    不存在的路径报 ENOENT —— xcopy "Invalid number of parameters" 同源。
  fs.mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (filter && !filter(s, e)) continue;
    if (e.isDirectory()) n += copyDir(s, d, filter);
    else { fs.copyFileSync(s, d); n++; }
  }
  return n;
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// 后端：只给预构建 jar + Dockerfile，不需要源码
copyFile(`${ROOT}/backend/target/neighborhood-backend.jar`, `${STAGE}/backend/target/neighborhood-backend.jar`);
copyFile(`${ROOT}/backend/Dockerfile.prebuilt`, `${STAGE}/backend/Dockerfile.prebuilt`);

// ── 包内 jar 自检 ────────────────────────────────────────────────────────
// 教训（2026-11-01 线上事故）：服务器上跑的是**旧包**，里面根本没有
//   /api/provider/service-items/manage 这个接口。Spring 找不到处理器会退到
//   静态资源处理器，抛 NoResourceFoundException，被兜底分支报成
//   {"code":50000,"message":"系统繁忙"} —— 现场误以为「返回 50000 而不是 404，
//   说明接口存在、jar 是新的」，于是往数据库和数据上查了很久，
//   真正原因只是 jar 没更新。
//
// 所以打包时必须**直接验 jar 里的字节**，确认关键接口确实在包里。
// 靠推断（看返回码、看日志）已经证明是不可靠的。
const jarMarkers = [
  ['BOOT-INF/classes/com/neighborhood/service/controller/ProviderController.class', ['service-items/manage']],
  ['BOOT-INF/classes/com/neighborhood/service/service/ServiceItemService.class', ['listManageView']],
  ['BOOT-INF/classes/com/neighborhood/service/common/GlobalExceptionHandler.class', ['handleNoResource']],
  ['BOOT-INF/classes/com/neighborhood/service/controller/SystemController.class', ['/api/system', '/version']],
];
const jarCheck = verifyJarEntries(`${ROOT}/backend/target/neighborhood-backend.jar`, jarMarkers);
if (!jarCheck.ok) {
  console.error('  [失败] jar 里缺少关键内容，部署上去接口会 404：');
  for (const m of jarCheck.missing) console.error(`    - ${m}`);
  console.error('  重新执行 mvn -DskipTests package 再打包。');
  process.exit(1);
}
console.log('  jar 自检: 关键接口均在包内');

// 顺带写一份指纹，部署脚本用它核对「服务器上跑的到底是哪个包」
const jarBytes = fs.readFileSync(`${ROOT}/backend/target/neighborhood-backend.jar`);
const jarMd5 = crypto.createHash('md5').update(jarBytes).digest('hex');
fs.mkdirSync(`${STAGE}/deploy`, { recursive: true });
fs.writeFileSync(
  `${STAGE}/deploy/BUILD-INFO.txt`,
  [
    '# 本次部署包的构建指纹（部署脚本据此核对容器里跑的 jar 是否就是这一个）',
    `buildTime=${jarCheck.buildTime}`,
    `jarMd5=${jarMd5}`,
    `jarSize=${jarBytes.length}`,
    '',
  ].join('\n'),
  'utf8',
);

const webFiles = copyDir(`${ROOT}/admin-web/dist`, `${STAGE}/admin-web/dist`);
console.log(`  admin-web/dist   : ${webFiles} 个文件`);

// 部署配置：排除含密钥的 .env 文件
// ⚠️ 必须是「以 .env 结尾」，不能只判 `=== '.env'`：
//    用户常把生产凭据临时写成 deploy/nb-prod.env 再手动上传，
//    只挡 .env 会让这个文件进包，靠后面的密钥扫描兜底（虽然也能拦，但会中断打包）。
//    .env.example 不以 .env 结尾，不受影响。
const depFilter = (p, e) => {
  const base = path.basename(p);
  if (base === '.env' || base.endsWith('.env')) return false;   // 含密钥，绝不进包
  if (e.isDirectory() && (base === 'node_modules' || base === '.git' || base === 'ssl' || base === 'certbot-webroot')) return false;
  return true;
};
const depFiles = copyDir(`${ROOT}/deploy`, `${STAGE}/deploy`, depFilter);
console.log(`  deploy/          : ${depFiles} 个文件`);

const sqlFiles = copyDir(`${ROOT}/sql`, `${STAGE}/sql`);
console.log(`  sql/             : ${sqlFiles} 个文件`);
copyDir(`${ROOT}/docs`, `${STAGE}/docs`);
copyFile(`${ROOT}/README.md`, `${STAGE}/README.md`);

// ── 密钥扫描 ────────────────────────────────────────────────────────────
console.log('[4/5] 校验包内不含密钥');
const SECRET_PAT = /(NbLocal2026Dev|AdminDev123456|dev-provider-secret-change-me|dev-admin-secret-change-me)/;
const SCAN_EXT = /\.(ts|js|mjs|cjs|json|md|yml|yaml|sh|example|conf|txt|properties|xml|html|sql|cmd|env)$|Dockerfile/;
const leaks = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!SCAN_EXT.test(e.name)) continue;           // jar 是二进制，跳过
    let text;
    try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
    if (SECRET_PAT.test(text)) leaks.push(path.relative(STAGE, p).replace(/\\/g, '/'));
  }
})(STAGE);
if (fs.existsSync(`${STAGE}/deploy/.env`)) leaks.push('deploy/.env');
if (leaks.length) {
  console.error('  [失败] 检测到密钥字面量，已中止：');
  for (const l of leaks) console.error(`    - ${l}`);
  process.exit(1);
}
console.log('  未发现密钥字面量，通过');

// ── 压缩 ────────────────────────────────────────────────────────────────
console.log('[5/5] 压缩');
if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
execFileSync('tar', ['-czf', OUT, '-C', STAGE, '.'], { stdio: 'inherit' });

// ── 解包回验 ────────────────────────────────────────────────────────────
console.log('\n[回验] 校验包内条目');
// ⚠️ Windows 上的 bsdtar 输出 CRLF，不去掉末尾 \r 会让每个条目都匹配不上
const listing = execFileSync('tar', ['-tzf', OUT], { encoding: 'utf8' })
  .split('\n')
  .map((p) => p.trim())
  .filter(Boolean);
const backslash = listing.filter((p) => p.includes('\\'));
if (backslash.length) {
  console.error(`  [失败] 包内有 ${backslash.length} 个反斜杠路径条目，Linux 解开会变成畸形文件名：`);
  for (const p of backslash.slice(0, 5)) console.error(`    ${p}`);
  process.exit(1);
}
const required = [
  'backend/target/neighborhood-backend.jar',
  'backend/Dockerfile.prebuilt',
  'admin-web/dist/index.html',
  'deploy/docker-compose.prod.yml',
  'deploy/deploy.sh',
  'deploy/pull-images.sh',
  'deploy/.env.example',
  'deploy/README.md',
  'deploy/nginx/community-gateway.conf',
  'deploy/nginx/community-gateway-http.conf',
  'deploy/nginx/community-internal.conf',
  'sql/schema.sql',
  'sql/seed.sql',
  'deploy/migrate.sh',
  'deploy/diagnose.sh',
  'deploy/diagnose-50000.sh',
  'deploy/BUILD-INFO.txt',
];
// ⚠️ migrations 目录下的每个 .sql 都要在包里。
//    漏掉 = 服务器上迁移无从执行 = 新表建不出来 = 功能上线即 500。
//    这个目录是新增的，容易在调整白名单时被漏掉，所以逐个点名回验。
const migrationFiles = fs.existsSync(`${ROOT}/deploy/migrations`)
  ? fs.readdirSync(`${ROOT}/deploy/migrations`).filter((f) => f.endsWith('.sql'))
  : [];
for (const f of migrationFiles) {
  required.push(`deploy/migrations/${f}`);
}
const set = new Set(listing.map((p) => p.replace(/^\.\//, '')));
// 任何 .env 结尾的条目都算泄漏（.env.example 不以 .env 结尾，安全）
const envLeaks = [...set].filter((p) => path.basename(p).endsWith('.env'));
if (envLeaks.length) {
  console.error('  [失败] 包内含 .env 文件：');
  for (const p of envLeaks) console.error(`    ${p}`);
  process.exit(1);
}
const notFound = required.filter((p) => !set.has(p));
if (notFound.length) {
  console.error('  [失败] 包内缺少关键文件：');
  for (const p of notFound) console.error(`    ${p}`);
  process.exit(1);
}
console.log(`  条目 ${listing.length} 个，全部为正斜杠路径`);
console.log(`  关键文件 ${required.length} 项齐全，无任何 .env 文件`);

fs.rmSync(STAGE, { recursive: true, force: true });

const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log('\n============================================================');
console.log(`产物: ${OUT}`);
console.log(`大小: ${mb} MB`);
console.log('============================================================');
console.log('\n上传到服务器后执行：');
console.log('  tar -xzf nbservice-deploy.tar.gz -C /opt/nbservice');
console.log('  cd /opt/nbservice');
console.log('  # 把本地写好的 .env 传上来（放 /opt/nbservice/，再 mv 进 deploy/）');
console.log('  #   需含：WX_APP_ID / WX_APP_SECRET / ADMIN_PASSWORD / GATEWAY_NETWORK');
console.log('  #   传完记得补末尾换行：printf "\\n" >> deploy/.env');
console.log('  chmod +x deploy/deploy.sh && ./deploy/deploy.sh');
console.log('\n然后按 deploy/README.md 完成「网关接入」与「签发证书」两节。');
