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
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
];
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
