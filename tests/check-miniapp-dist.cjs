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

console.log();
console.log(fail === 0 ? '[PASS] 小程序产物检查通过' : `[FAIL] ${fail} 项未通过`);
process.exit(fail === 0 ? 0 : 1);
