const fs = require('node:fs');
const path = require('node:path');

const DIST = process.env.MINIAPP_DIST || require('node:path').resolve(__dirname, '..', 'miniapp', 'dist');
const EXPECT = 'https://community.aindgc.com';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  [OK] ' : '  [!!] ') + m); if (!c) fail++; };
/** 只提醒不阻断：留给「暂时占位、后续替换」这类项 */
const note = (m) => { console.log('  [提醒] ' + m); };

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

// 0. 🔴 配置层护栏：dev 与 prod 两份配置都必须**保持 Taro 默认的 optimization**
//
//    曾经这里断言的是「两份配置都要关掉 splitChunks / runtimeChunk」——
//    那条断言本身是错的，它把一个更大的 bug 固化了下来。
//
//    真相：Taro 4 的小程序产物里，app / comp / 每个页面都是**独立的 webpack 入口**。
//    关掉 splitChunks → webpack 把 @tarojs/runtime **物理复制**进每一个入口文件。
//    实测过：19 个 js 文件里各有一份自己的 `Current = { app: null }`。
//    而 Current 是 @tarojs/runtime 的**单例**：
//      - Current.app 由 createReactApp() 赋值（只在 app.js 那一份里执行）
//      - 页面 onLoad 时用 Current.app.mount(...) 挂载 React 树
//    页面那份副本没人赋值 → 恒为 null →
//        TypeError: Cannot read property 'mount' of null
//            at mount  (@tarojs/runtime/dist/dsl/common.ts)
//            at onLoad (@tarojs/runtime/dist/dsl/common.ts)
//    → 打开任何页面都白屏。
//
//    正确形态：保持 Taro 默认的 splitChunks —— @tarojs/runtime 被抽成公共 chunk
//    （taro.js），配合 webpack 的 wx.webpackJsonp 全局注册表，
//    所有入口共用同一份模块实例，Current 才是唯一的。
//    公共 chunk 之间用 require("./taro.js") 串联 —— 微信小程序 JS 支持 require
//    其它 JS 文件，这是 Taro 官方产物形态，不是问题。
//
//    另外 dev / prod **两边**都必须关掉 prebundle（module federation）：
//    开启时页面 chunk 只 push 到 wx.webpackJsonp，依赖 remoteEntry 注册远程容器，
//    时序对不上页面模块就永远不执行 → 白屏 + 只有 tabbar。
// 断言本体在 tests/check-miniapp-config.cjs（不依赖产物，可单独跑，
// 并挂在 npm 的 predev:weapp / prebuild:weapp 钩子上做前置闸门），
// 这里只复用结果，避免两处各写一份、日后漂移。
const { check: checkMiniappConfig } = require('./check-miniapp-config.cjs');
for (const r of checkMiniappConfig()) ok(r.ok, r.msg);

// 1. 不能有未内联的 process.env.TARO_APP_* 残留
//
//    小程序运行时没有 process 对象，残留的 process.env.TARO_APP_XXX 会直接抛
//    ReferenceError: process is not defined（构建能过，启动才炸）。
//
//    ⚠️ 只查 TARO_APP_ 前缀，且要先剥掉块注释：
//      - Taro 框架自身会注入 process.env.NODE_ENV / TARO_ENV / FRAMEWORK，
//        这些由框架在运行时提供，不是我们的问题；
//      - dev/watch 产物不压缩，JSDoc 注释会原样留在产物里，
//        request.ts 的注释里就写着 "process.env.TARO_APP_*"，直接全量查必然误报。
let procHits = [];
for (const f of files) {
  const t = stripBlockComments(fs.readFileSync(f, 'utf8'));
  if (/process\.env\.TARO_APP_/.test(t)) procHits.push(path.relative(DIST, f));
}
ok(procHits.length === 0, `无未内联的 process.env.TARO_APP_* 残留${procHits.length ? '：' + procHits.slice(0, 3).join(', ') : ''}`);

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

// 5. 🔴 @tarojs/runtime 必须只有**一份物理副本**
//
//    Current 是 @tarojs/runtime 的单例：Current.app 由 createReactApp() 赋值，
//    页面 onLoad 时用 Current.app.mount(...) 挂载 React 树。
//    一旦 runtime 被复制成 N 份（N = 入口数），页面那份的 Current.app 恒为 null，
//    打开任何页面都抛 `Cannot read property 'mount' of null` → 纯白屏。
//
//    判据：Current 的字面量定义 `app:null,router:null,page:null`
//    （terser 不会改属性名，压缩前后都能匹配；比较前先去掉所有空白）。
const CURRENT_PAT = 'app:null,router:null,page:null';
const currentFiles = files.filter(f =>
  fs.readFileSync(f, 'utf8').replace(/\s+/g, '').includes(CURRENT_PAT));
ok(currentFiles.length === 1,
  `Taro runtime 只有一份副本（应为 1，实际 ${currentFiles.length}）` +
  (currentFiles.length !== 1
    ? '：' + currentFiles.map(f => path.relative(DIST, f)).slice(0, 3).join(', ')
    : ''));

// 6. 公共 chunk 必须存在，且入口文件用 require 把它串起来
//    （微信小程序 JS 支持 require 其它 JS 文件，这是 Taro 官方产物形态）
const sharedChunks = files
  .map(f => path.basename(f))
  .filter(n => ['taro.js', 'common.js', 'vendors.js'].includes(n));
ok(sharedChunks.length > 0, `存在公共 chunk：${sharedChunks.join(', ') || '无'}`);
const appJsPath = path.join(DIST, 'app.js');
if (fs.existsSync(appJsPath)) {
  const appJs = fs.readFileSync(appJsPath, 'utf8');
  ok(/require\("\.\/taro"\)/.test(appJs), 'app.js 用 require 引入公共 chunk taro.js');
}

/**
 * 取「某页面可见的全部文案」。
 *
 * 开启 splitChunks 后，页面自己的 chunk 只剩页面专属代码；
 * 共用组件（ConsentCheckbox）、共用常量（constants/policy.ts）会被
 * webpack 抽进公共 chunk（common.js）。只查页面 chunk 会误报「文案缺失」。
 * 所以这里把页面 chunk + 全部公共 chunk 拼起来一起找。
 */
const sharedChunkFiles = files.filter(f => sharedChunks.includes(path.basename(f)));
function pageText (route) {
  const p = path.join(DIST, route + '.js');
  if (!fs.existsSync(p)) return null;
  return [fs.readFileSync(p, 'utf8'), ...sharedChunkFiles.map(f => fs.readFileSync(f, 'utf8'))].join('\n');
}

// 7. app.json / project.config.json 不能有 BOM
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

// 8. app.json 里声明的每个页面，三件套产物都得存在
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

// 9. 🔴 推广页必须在主页关闭时给出醒目提示 + 去开启的入口
//
//    背景：推广码在服务者**注册时**就发下去了，主页一旦是关的，
//    客户扫码只会拿到 41008「该服务主页已关闭」。而「开启主页」开关
//    藏在「编辑主页」里，服务者最容易忽略 —— 所以推广页必须显式警告。
const referralText = pageText('pages/referral/index');
if (referralText !== null) {
  const t = referralText;
  ok(t.includes('notice--danger'), '推广页含「主页未开启」的醒目告警样式');
  ok(hasText(t, '去开启服务主页'), '推广页含「去开启服务主页」入口');
  // 推广码要能真正用起来：能存到手机、文案说清楚客户扫码会发生什么
  ok(hasText(t, '保存到相册'), '推广页含「保存到相册」（把码存到手机才能发给客户）');
  ok(hasText(t, '客户扫码预约'), '推广页说明了「客户扫码预约」这件事');
  ok(t.includes('saveImageToPhotosAlbum'), '推广页接入了保存到相册的微信能力');
  // 底部意见反馈入口：与服务主页（pages/provider）同一套样式
  ok(t.includes('feedback-entry'), '推广页底部含意见反馈入口（与服务主页同款样式）');
  ok(hasText(t, '意见反馈'), '推广页底部含「意见反馈」文案');
  ok(t.includes('/pages/feedback/index'), '推广页的意见反馈入口跳转到反馈页');
  // 视频推广指导入口：排在二维码旁边，点了就地播放
  ok(t.includes('video-tile'), '推广页含「视频推广指导」入口（与二维码并排）');
  ok(hasText(t, '视频推广指导'), '推广页含「视频推广指导」文案');
  ok(t.includes('video-player'), '推广页含视频播放器');
  // 地址改成后台可配置：后端随推广信息一起下发，小程序读 promoVideoUrl。
  // 若这里还能搜到 example.com，说明代码里留了硬编码占位地址，
  // 管理员在后台配好了也还是播占位地址。
  ok(t.includes('promoVideoUrl'), '推广页的视频地址来自后端配置（promoVideoUrl）');
  ok(!t.includes('example.com'), '推广页产物里没有残留的占位视频地址');
} else {
  ok(false, '找不到推广页产物 pages/referral/index.js');
}

// 10. 🔴 客户主页必须对 41008 单独处理，不能只甩一句「重新加载」
//
//    主页关闭是客户自己解决不了的状态，让他反复点重试只会以为是自己手机的问题。
const providerText = pageText('pages/provider/index');
if (providerText !== null) {
  const t = providerText;
  ok(t.includes('41008'), '客户主页含 41008 业务码的专门处理');
  ok(hasText(t, '暂未开放服务主页'), '客户主页含可读文案，而不是让客户干点重试');
} else {
  ok(false, '找不到客户主页产物 pages/provider/index.js');
}

// 11. 🔴 协议页面必须存在且有实质内容
//
//     微信审核要求补充《用户服务协议》《隐私政策》并可访问。
//     页面缺失或只有壳，审核员点开看到空白 = 直接驳回。
const appJson = JSON.parse(fs.readFileSync(path.join(DIST, 'app.json'), 'utf8'));
for (const [route, kw] of [
  ['pages/legal/terms/index', '用户服务协议'],
  ['pages/legal/privacy/index', '隐私政策']
]) {
  ok((appJson.pages || []).includes(route), `app.json 声明了 ${route}`);
  const t = pageText(route);
  if (t !== null) {
    ok(hasText(t, kw), `${route} 含「${kw}」正文`);
    // 隐私政策必须写清楚「收集什么 / 用来干什么 / 怎么存」这三件事
    if (route.includes('privacy')) {
      ok(hasText(t, '我们收集的信息'), '隐私政策写明了收集的信息范围');
      ok(hasText(t, '使用目的'), '隐私政策写明了使用目的');
      ok(hasText(t, '存储'), '隐私政策写明了存储方式');
    }
  } else {
    ok(false, `缺少 ${route} 的产物`);
  }
}

// 12. 🔴 登录 / 注册页必须强制勾选同意
//
//     审核要求「取得用户授权同意后，才能获取用户信息」，
//     勾选框 + 未勾选拦截是这条要求的唯一落点。
for (const [route, label] of [
  ['pages/auth/login/index', '登录页'],
  ['pages/auth/register/index', '注册页']
]) {
  const t = pageText(route);
  if (t === null) {
    ok(false, `缺少 ${route} 的产物`);
    continue;
  }
  ok(hasText(t, '我已阅读并同意'), `${label}含「我已阅读并同意」勾选文案`);
  ok(hasText(t, '请先阅读并同意'), `${label}未勾选时有拦截提示`);
}

// 13. 🔴 前后端协议版本必须一致
//
//     前端把读到的版本号随注册/登录提交，后端据此留证。
//     两边一旦漂移，留证指向的就是用户根本没看过的版本 —— 等于没留证。
const POLICY_SRC = path.resolve(__dirname, '..', 'miniapp', 'src', 'constants', 'policy.ts');
const CONSENT_SRC = path.resolve(
  __dirname, '..', 'backend', 'src', 'main', 'java', 'com', 'neighborhood', 'service', 'service', 'ConsentService.java'
);
if (fs.existsSync(POLICY_SRC) && fs.existsSync(CONSENT_SRC)) {
  const front = fs.readFileSync(POLICY_SRC, 'utf8');
  const back = fs.readFileSync(CONSENT_SRC, 'utf8');
  const fv = (front.match(/POLICY_VERSION\s*=\s*'([^']+)'/) || [])[1];
  const bv = (back.match(/CURRENT_POLICY_VERSION\s*=\s*"([^"]+)"/) || [])[1];
  ok(!!fv && !!bv && fv === bv,
    `前后端协议版本一致（前端 ${fv} / 后端 ${bv}）`);
} else {
  ok(false, '找不到 policy.ts 或 ConsentService.java，无法校验协议版本');
}

// 13. 🔴 推广指导视频的地址：必须由后端下发，代码里不能再留硬编码地址
//
//     地址已改成管理后台可配置：存在 system_settings 的 promo.video.url 里，
//     后端随推广信息一起下发，小程序读 info.promoVideoUrl。
//     代码里残留一个占位地址 = 管理员配好后，用户点开还是播占位地址。
const VIDEO_SRC = path.resolve(__dirname, '..', 'miniapp', 'src', 'constants', 'promo-video.ts');
if (fs.existsSync(VIDEO_SRC)) {
  const vt = fs.readFileSync(VIDEO_SRC, 'utf8');
  const hardcoded = vt.match(/https?:\/\/\S+/);
  ok(!hardcoded,
    hardcoded
      ? `promo-video.ts 里残留硬编码地址 ${hardcoded[0]}（应改由后台配置）`
      : 'promo-video.ts 里没有硬编码的视频地址（由后台配置下发）');
  note('推广指导视频地址在管理后台「系统基础设置」里配（配置项 promo.video.url）');
  note('配完还要把视频域名加进小程序后台的 downloadFile 合法域名，否则真机黑屏');
} else {
  ok(false, '找不到 miniapp/src/constants/promo-video.ts');
}

/**
 * 产物里的中文会被转义成 \uXXXX，检查时要两种写法都认。
 *
 * ⚠️ 十六进制有大小写两种输出：压缩后的产物（terser）用小写 \u53bb，
 *    未压缩的 dev/watch 产物用大写 \u53BB。只试一种会误报。
 */
function hasText(t, s) {
  if (t.includes(s)) return true;
  const lower = Array.from(s)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : ch;
    })
    .join('');
  if (t.includes(lower)) return true;
  const upper = Array.from(s)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code > 127 ? '\\u' + code.toString(16).toUpperCase().padStart(4, '0') : ch;
    })
    .join('');
  return t.includes(upper);
}

/** 剥掉 /* ... *\/ 块注释，避免 JSDoc 里的文字干扰内容检查。 */
function stripBlockComments(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, '');
}

console.log();
console.log(fail === 0 ? '[PASS] 小程序产物检查通过' : `[FAIL] ${fail} 项未通过`);
process.exit(fail === 0 ? 0 : 1);
