const fs = require('node:fs');
const path = require('node:path');

const DIST = process.env.MINIAPP_DIST || require('node:path').resolve(__dirname, '..', 'miniapp', 'dist');
const EXPECT = 'https://community.aindgc.com';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  [OK] ' : '  [!!] ') + m); if (!c) fail++; };

if (!fs.existsSync(DIST)) {
  console.error(`[FAIL] 找不到产物目录: ${DIST}`);
  process.exit(1);
}

// 收集所有 js 文件
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(DIST);

console.log('=== 产物检查 ===');
console.log(`  js 文件: ${files.length} 个\n`);

// 1. 不能有 process.env 残留
let procHits = [];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  if (t.includes('process.env')) procHits.push(path.relative(DIST, f));
}
ok(procHits.length === 0, `无 process.env 残留${procHits.length ? '：' + procHits.slice(0, 3).join(', ') : ''}`);

// 2. BASE_URL 必须是字面量，且等于线上域名
let found = null, hitFiles = [];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  // 形如  var n="https://community.aindgc.com"  或 BASE_URL 赋值
  const m = t.match(/https:\/\/[a-z0-9.-]+(?::\d+)?/g);
  if (m) {
    for (const u of new Set(m)) {
      hitFiles.push([path.relative(DIST, f), u]);
      if (u === EXPECT) found = u;
    }
  }
}
ok(found === EXPECT, `产物里含正确域名 ${EXPECT}`);
if (!found) {
  console.log('       实际出现的域名:');
  const uniq = [...new Set(hitFiles.map(x => x[1]))];
  for (const u of uniq) console.log('         ' + u);
} else {
  console.log('       出现位置:');
  for (const [f, u] of hitFiles.filter(x => x[1] === EXPECT)) console.log(`         ${f}`);
}

// 3. 不能有 localhost 残留（生产包连 localhost 等于没配）
const local = hitFiles.filter(([, u]) => /localhost|127\.0\.0\.1/.test(u));
ok(local.length === 0, `无 localhost 残留${local.length ? '：' + local.map(x => x[1]).join(', ') : ''}`);

// 4. 旧域名不能残留
const old = hitFiles.filter(([, u]) => /localhost|127\.0\.0\.1|aindgc\.com/.test(u) && u !== EXPECT);
ok(old.length === 0, `无其它域名残留${old.length ? '：' + old.map(x => x[1]).join(', ') : ''}`);

// 5. 🔴 产物里不能有 CommonJS require()
//
//    微信小程序运行时**没有 require 这个全局对象**。只要产物里出现顶层
//    `require("./xxx")`，小程序启动第一行就抛 `require is not defined`，
//    表现为纯白屏，且 Console 里没有任何业务报错 —— 最难定位的一类故障。
//
//    来源：Taro 默认的 optimization.splitChunks + runtimeChunk 会把代码拆成
//    runtime / common / vendors / taro 四个 chunk，它们之间用 CommonJS 互连。
//    dev 模式不拆，所以只有 build:weapp 会中招。
const requireHits = [];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const m = t.match(/\brequire\s*\(\s*["']/g);
  if (m) requireHits.push(`${path.relative(DIST, f)} (${m.length} 处)`);
}
ok(requireHits.length === 0,
   `无 CommonJS require()（微信运行时不支持）${requireHits.length ? '：' + requireHits.join(', ') : ''}`);

// 6. app.json / project.config.json 不能有 BOM
let bomHits = [];
(function walkAll(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkAll(p);
    else if (/\.(json|js|wxml|wxss|wxs)$/.test(e.name)) {
      const buf = fs.readFileSync(p);
      if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) bomHits.push(path.relative(DIST, p));
    }
  }
})(DIST);
ok(bomHits.length === 0, `无 BOM 文件${bomHits.length ? '：' + bomHits.join(', ') : ''}`);

// 7. app.json 里声明的每个页面，三件套产物都得存在
let missingPages = [];
const appJsonPath = path.join(DIST, 'app.json');
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  for (const page of appJson.pages || []) {
    for (const ext of ['.js', '.wxml', '.json']) {
      const p = path.join(DIST, page + ext);
      if (!fs.existsSync(p)) missingPages.push(page + ext);
    }
  }
}
ok(missingPages.length === 0,
   `app.json 声明的页面产物齐全${missingPages.length ? '，缺失：' + missingPages.slice(0, 5).join(', ') : ''}`);

console.log();
console.log(fail === 0 ? '[PASS] 小程序产物检查通过' : `[FAIL] ${fail} 项未通过`);
process.exit(fail === 0 ? 0 : 1);
