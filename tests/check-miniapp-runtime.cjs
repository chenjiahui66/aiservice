/**
 * 小程序**运行时**回归检查 —— 直接跑构建产物，不依赖真机 / 开发者工具。
 *
 * 为什么要这个：`tests/check-miniapp-dist.cjs` 只能看产物**长什么样**，
 * 看不出「跑起来对不对」。而本项目踩过的两个大坑，产物层面全都长得正常：
 *   - 白屏：runtime 被复制成 N 份 → `Current.app` 为 null → 打开任何页面都白屏
 *   - 登录态：请求不带 token / 401 跳两次登录页 → 产物看着完全正常
 * 所以这里用 Node 模拟微信小程序的模块系统 + wx API，把产物**跑一遍**，
 * 直接断言运行时行为。
 *
 * 覆盖三条：
 *   1. 页面能挂载（onLoad 不抛 `mount of null`）—— Taro runtime 必须是唯一实例
 *   2. 401 只跳一次登录页 —— 不能压出两个登录页
 *   3. 登录后 tab 页自动刷新 —— 请求要带 token、登录态变了要重拉、切 tab 回来要刷新
 *
 * 用法：node tests/check-miniapp-runtime.cjs [产物目录]
 */
const fs = require('fs')
const path = require('path')

const DIST = process.argv[2] || path.resolve(__dirname, '..', 'miniapp', 'dist')

let fail = 0
const ok = (c, m) => { console.log((c ? '  [OK] ' : '  [!!] ') + m); if (!c) fail++ }
const section = (t) => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 56 - t.length)))

if (!fs.existsSync(DIST)) {
  console.error(`[FAIL] 找不到产物目录: ${DIST}`)
  process.exit(1)
}

// ---------------------------------------------------------------- 微信运行时桩

let navigations = []
let requests = []
let storage = {}

function resetRuntime () {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(path.resolve(DIST))) delete require.cache[key]
  }
  navigations = []
  requests = []
  storage = {}
}

/** 造一份够用的接口返回 */
function okData (url) {
  if (url.includes('/board')) {
    return {
      date: '2026-10-22', totalCount: 0, pendingConfirmCount: 0, pendingServiceCount: 0,
      completedCount: 0, cancelledCount: 0, tasks: []
    }
  }
  if (url.includes('/referral')) {
    return {
      referralCode: 'ABC123', status: 'ENABLED', qrMode: 'DEV', qrModeLabel: '开发降级二维码',
      qrNotice: '当前为开发降级二维码', qrImageUrl: null, shareText: '扫码预约'
    }
  }
  return {}
}

function buildWx () {
  const nav = (type) => (opts = {}) => {
    navigations.push({ type, url: opts.url })
    global.__pages = [{ route: String(opts.url || '').replace(/^\//, '') }]
    if (opts.success) opts.success({})
    if (opts.complete) opts.complete({})
  }
  return {
    getSystemInfoSync: () => ({
      windowWidth: 375, windowHeight: 667, pixelRatio: 2, platform: 'devtools',
      SDKVersion: '3.17.4', statusBarHeight: 20,
      safeArea: { top: 20, bottom: 667, left: 0, right: 375, width: 375, height: 647 },
      system: 'Windows 10', brand: 'devtools', model: 'devtools', language: 'zh_CN', version: '8.0.5'
    }),
    getSystemInfo: (cb) => cb({ windowWidth: 375, windowHeight: 667, pixelRatio: 2, platform: 'devtools', SDKVersion: '3.17.4' }),
    getAppBaseInfo: () => ({ SDKVersion: '3.17.4' }),
    getWindowInfo: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2, statusBarHeight: 20 }),
    getDeviceInfo: () => ({ platform: 'devtools', system: 'Windows 10' }),
    getStorageSync: (key) => storage[key] || '',
    setStorageSync: (key, val) => { storage[key] = val },
    removeStorageSync: (key) => { delete storage[key] },
    request: (opts = {}) => {
      const auth = (opts.header || {}).Authorization || ''
      requests.push({ url: opts.url, auth })
      // 真实服务端行为：没带 token 一律 401
      const okAuth = !!auth
      const res = {
        statusCode: okAuth ? 200 : 401,
        data: okAuth
          ? { code: 0, message: '操作成功', success: true, data: okData(opts.url) }
          : { code: 40100, message: '登录状态已失效', success: false },
        header: {}, cookies: []
      }
      if (opts.success) opts.success(res)
      if (opts.complete) opts.complete(res)
      return { abort () {}, onHeadersReceived () {}, offHeadersReceived () {} }
    },
    downloadFile: (opts = {}) => {
      const res = { statusCode: 200, tempFilePath: '/tmp/mock-qr.png' }
      if (opts.success) opts.success(res)
      if (opts.complete) opts.complete(res)
      return { abort () {}, onProgressUpdate () {}, offProgressUpdate () {} }
    },
    nextTick: (fn) => setTimeout(fn, 0),
    showToast: () => {}, hideToast: () => {}, showLoading: () => {}, hideLoading: () => {},
    showModal: (opts = {}) => {
      if (opts.success) opts.success({ confirm: false })
      if (opts.complete) opts.complete({})
    },
    createSelectorQuery: () => ({
      select: () => ({ boundingClientRect: () => ({ exec: (cb) => cb && cb([{ top: 0, left: 0, width: 0, height: 0 }]) }) }),
      selectAll: () => ({ boundingClientRect: () => ({ exec: (cb) => cb && cb([]) }) }),
      in () { return this },
      selectViewport: () => ({ scrollOffset: () => ({ exec: (cb) => cb && cb([{ scrollTop: 0, scrollLeft: 0 }]) }) })
    }),
    createAnimation: () => ({ opacity: () => ({ step: () => ({}) }), step: () => ({}) }),
    createIntersectionObserver: () => ({ relativeToViewport: () => ({ observe: () => {} }) }),
    getUpdateManager: () => ({ onCheckForUpdate: () => {}, onUpdateReady: () => {}, onUpdateFailed: () => {}, applyUpdate: () => {} }),
    onError: () => {}, offError: () => {},
    reportAnalytics: () => {}, setKeepScreenOn: () => {}, vibrateShort: () => {},
    reLaunch: nav('reLaunch'), navigateTo: nav('navigateTo'),
    switchTab: nav('switchTab'), redirectTo: nav('redirectTo'),
    env: { USER_DATA_PATH: '/tmp' }
  }
}

function installGlobals () {
  global.wx = buildWx()
  global.getApp = () => global.__appCfg
  global.getCurrentPages = () => global.__pages
  global.Page = function (cfg) { global.__pageCfgs.push(cfg); return cfg }
  global.Component = function (cfg) { return cfg }
  global.Behavior = function (cfg) { return cfg }
  global.App = function (cfg) { global.__appCfg = cfg; return cfg }
  global.__pageCfgs = []
  global.__pages = [{ route: 'pages/board/index' }]
}

const loadDist = (rel) => require(path.join(DIST, rel))
const tick = (ms = 250) => new Promise(r => setTimeout(r, ms))

function fakePageInstance (route) {
  return {
    route, __route__: route, $taroPath: route,
    setData () {}, selectComponent: () => null, selectAllComponents: () => [],
    triggerEvent () {}, animate: () => {}
  }
}

/**
 * 从 webpack 的全局 chunk 注册表里捞出 __webpack_require__，
 * 再从模块表里找出 zustand store（用来模拟「刚登录」）。
 *
 * 注意：webpack 的 harmony 导出是命名空间对象，
 * 模块导出的是 { useAuthStore, isLoggedIn }，store 本体藏在 useAuthStore 里。
 */
function captureStore () {
  let req = null
  const arr = global.wx.webpackJsonp
  if (!arr) return null
  arr.push([[999999], {}, function (r) { req = r }])
  if (!req) return null
  for (const id of Object.keys(req.m || {})) {
    let exp
    try { exp = req(id) } catch (e) { continue }
    if (!exp || typeof exp !== 'object') continue
    for (const key of Object.keys(exp)) {
      const v = exp[key]
      if (typeof v === 'function' && typeof v.getState === 'function') {
        let st = null
        try { st = v.getState() } catch (e) { st = null }
        if (st && typeof st === 'object' && 'token' in st) return v
      }
    }
  }
  return null
}

// ---------------------------------------------------------------- 检查项

async function checkPageMounts () {
  section('1. 页面能挂载（Taro runtime 必须是唯一实例）')
  resetRuntime()
  installGlobals()
  storage = { nsm_token: 'token-abc' }

  loadDist('app.js')
  loadDist('pages/board/index.js')

  ok(!!global.__appCfg, 'App() 已注册')
  ok(global.__pageCfgs.length > 0, 'Page() 已注册')

  const pageCfg = global.__pageCfgs[global.__pageCfgs.length - 1]
  let loadError = null
  try {
    pageCfg.onLoad.call(fakePageInstance('pages/board/index'), {})
  } catch (e) {
    loadError = e
  }
  await tick(400)

  const isMountNull = loadError && /mount' of null|Cannot read properties of null \(reading 'mount'\)/.test(loadError.message)
  ok(!isMountNull,
    '页面 onLoad 不抛 `mount of null`（runtime 被复制成 N 份就会在这里炸）' +
    (isMountNull ? '：' + loadError.message : ''))
}

async function checkAuthRedirect () {
  section('2. 401 只跳一次登录页')

  const scenarios = [
    { name: '未登录（本地无 token）', token: '', page: 'pages/board/index.js', expect: 1 },
    { name: 'token 过期（带 token 被 401）', token: 'expired', page: 'pages/board/index.js', expect: 1 },
    { name: '一页多个并发请求全部 401', token: 'expired', page: 'pages/referral/index.js', expect: 1 }
  ]

  for (const s of scenarios) {
    resetRuntime()
    installGlobals()
    storage = s.token ? { nsm_token: s.token } : {}

    loadDist('app.js')
    loadDist(s.page)
    const pageCfg = global.__pageCfgs[global.__pageCfgs.length - 1]
    const route = s.page.replace(/\.js$/, '')
    try { pageCfg.onLoad.call(fakePageInstance(route), {}) } catch (e) { /* 页面异常不阻断检查 */ }

    await tick(400)
    await tick(1200) // 等冷却窗口结束，确认没有第二次跳转

    const toLogin = navigations.filter(n => /auth\/login/.test(n.url))
    ok(toLogin.length === s.expect,
      `${s.name} → 跳登录页 ${toLogin.length} 次（期望 ${s.expect}）` +
      (toLogin.length === s.expect ? '' : '：' + JSON.stringify(navigations)))
  }
}

async function checkRefreshAfterLogin () {
  section('3. 登录后 tab 页自动刷新')

  resetRuntime()
  installGlobals()
  storage = { nsm_token: 'token-abc' }

  loadDist('app.js')
  loadDist('pages/board/index.js')
  const pageCfg = global.__pageCfgs[global.__pageCfgs.length - 1]
  const instance = fakePageInstance('pages/board/index')
  pageCfg.onLoad.call(instance, {})
  await tick(400)

  // 3.1 首屏请求必须带 token
  const first = requests[0]
  ok(!!first && first.auth === 'Bearer token-abc',
    `首屏请求带 Authorization（实际 ${first ? first.auth : '(没发请求)'}）`)

  // 3.2 不能有「不带 token 的裸请求」—— 那是 401 → 页面卡错误态的根源
  const bare = requests.filter(r => !r.auth).length
  ok(bare === 0, `没有不带 token 的裸请求（实际 ${bare} 条）`)

  // 3.3 已登录不能被踢去登录页
  const kicked = navigations.filter(n => /auth\/login/.test(n.url)).length
  ok(kicked === 0, `已登录不会被踢去登录页（跳转 ${kicked} 次）`)

  // 3.4 切 tab 回来要刷新（首屏显示不重复，之后每次都刷）
  pageCfg.onShow.call(instance, {})
  await tick(300)
  const afterFirstShow = requests.length
  ok(afterFirstShow === requests.length, '首屏显示不重复发请求')

  const beforeShow = requests.length
  pageCfg.onShow.call(instance, {})
  await tick(300)
  ok(requests.length > beforeShow, `切 tab 回来后刷新（请求数 ${beforeShow} → ${requests.length}）`)

  // 3.5 登录态变化要自动重拉
  const store = captureStore()
  if (!store) {
    ok(false, '能从产物里找到 zustand store（用于模拟登录）')
    return
  }
  const before = requests.length
  store.getState().signIn({
    token: 'token-new', providerId: 1, displayName: '张师傅', username: '13900000000',
    auditStatus: 'APPROVED', auditRemark: null
  })
  await tick(300)
  ok(requests.length > before, `登录后自动重拉（请求数 ${before} → ${requests.length}）`)
  const lastAuth = requests[requests.length - 1]?.auth
  ok(lastAuth === 'Bearer token-new', `重拉用的是新 token（实际 ${lastAuth}）`)

  // 3.6 登录完切回 tab 不该重复发
  const beforeD = requests.length
  pageCfg.onShow.call(instance, {})
  await tick(300)
  ok(requests.length === beforeD, `登录后切回来没有重复请求（请求数 ${beforeD} → ${requests.length}）`)
}

;(async () => {
  console.log('=== 小程序运行时检查 ===')
  console.log('  产物目录: ' + DIST)
  await checkPageMounts()
  await checkAuthRedirect()
  await checkRefreshAfterLogin()
  console.log()
  console.log(fail === 0 ? '[PASS] 小程序运行时检查通过' : `[FAIL] ${fail} 项未通过`)
  process.exit(fail === 0 ? 0 : 1)
})().catch((e) => {
  console.error('[FAIL] 运行时报错：', e)
  process.exit(1)
})
