/**
 * 小程序**构建配置**护栏 —— 不依赖产物，可单独跑。
 *
 * 为什么单独拆一个脚本：
 *   tests/check-miniapp-dist.cjs 里的配置断言要等产物构建完才跑得到，
 *   而 `npm run dev:weapp`（watch，日常开发用的那条）**根本不跑** dist 检查。
 *   结果就是：谁改了 dev.ts 的 optimization，watch 出来的包直接白屏，
 *   要等到下次跑 build:weapp 才被发现 —— 白白浪费一轮联调。
 *   拆出来后挂到 npm 的 pre 钩子上，watch 启动前就会先把配置验一遍。
 *
 * 验什么（三条，每一条都对应一个真实踩过的坑）：
 *
 *  1. 不许关 splitChunks / runtimeChunk
 *     Taro 4 小程序产物里 app / comp / 每个页面都是**独立的 webpack 入口**。
 *     关掉 splitChunks → webpack 把 @tarojs/runtime **物理复制**进每一个入口，
 *     实测 19 个 js 文件里各有一份自己的 `Current = { app: null }`。
 *     Current 是框架单例（Current.app 由 createReactApp 赋值，页面 onLoad 用它挂载
 *     React 树），页面那份副本没人赋值 → 恒为 null →
 *         TypeError: Cannot read property 'mount' of null
 *             at mount  (@tarojs/runtime/dist/dsl/common.ts)
 *             at onLoad (@tarojs/runtime/dist/dsl/common.ts)
 *     → 打开任何页面都白屏。
 *
 *  2. 必须关 prebundle（module federation）
 *     开启时页面 chunk 只 push 到 wx.webpackJsonp，依赖 prebundle/remoteEntry.js
 *     注册远程容器后才可解析；时序对不上页面模块永远不执行 → 白屏 + 只有 tabbar。
 *
 *  3. base 配置里不许出现 defineConstants
 *     webpack-chain 的 merge 对 defineConstants 是**整体覆盖**，
 *     baseConfig 写一个空对象就会把 dev.ts / prod.ts 的值顶掉，
 *     产物里 process.env.TARO_APP_API_BASE 被替换成 0，BASE_URL 静默退回
 *     localhost —— 构建不报错，真机却连不上接口。
 */
const fs = require('node:fs')
const path = require('node:path')

const CONFIG_DIR = path.resolve(__dirname, '..', 'miniapp', 'config')

/**
 * 剥掉注释再判断。
 *
 * 必须剥：这几个配置文件里大量注释会**正面提到**被禁的写法
 * （比如 config/index.ts 里写着「不要在 baseConfig 里写 defineConstants: {}」），
 * 直接对原文做正则会把注释当成配置，误报。
 */
function stripComments (src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 块注释
    .replace(/^[ \t]*\/\/.*$/gm, '')    // 整行行注释
}

/** @returns {{ok: boolean, msg: string}[]} */
function check () {
  const results = []

  for (const name of ['dev.ts', 'prod.ts']) {
    const p = path.join(CONFIG_DIR, name)
    if (!fs.existsSync(p)) {
      results.push({ ok: false, msg: `找不到配置文件 ${name}` })
      continue
    }
    const t = stripComments(fs.readFileSync(p, 'utf8'))
    results.push({
      ok: !/splitChunks\s*:\s*false/.test(t),
      msg: `${name} 没有关掉 splitChunks（关掉会让 runtime 被复制成 N 份 → 页面全白屏）`
    })
    results.push({
      ok: !/runtimeChunk\s*:\s*false/.test(t),
      msg: `${name} 没有关掉 runtimeChunk`
    })
    results.push({
      ok: /prebundle[\s\S]{0,120}enable\s*:\s*false/.test(t),
      msg: `${name} 关掉了 prebundle（module federation 会让页面 chunk 永不执行）`
    })
  }

  // base 配置（config/index.ts）不能覆盖 defineConstants
  const basePath = path.join(CONFIG_DIR, 'index.ts')
  if (!fs.existsSync(basePath)) {
    results.push({ ok: false, msg: '找不到配置文件 index.ts' })
  } else {
    const t = stripComments(fs.readFileSync(basePath, 'utf8'))
    results.push({
      ok: !/defineConstants\s*:/.test(t),
      msg: 'index.ts 没有覆盖 defineConstants（会整体覆盖 dev/prod 的值，BASE_URL 静默退回 localhost）'
    })
  }

  return results
}

module.exports = { check, CONFIG_DIR }

if (require.main === module) {
  const results = check()
  let fail = 0
  console.log('=== 小程序构建配置检查 ===')
  for (const r of results) {
    console.log((r.ok ? '  [OK] ' : '  [!!] ') + r.msg)
    if (!r.ok) fail++
  }
  console.log()
  console.log(fail === 0 ? '[PASS] 小程序构建配置检查通过' : `[FAIL] ${fail} 项未通过`)
  process.exit(fail === 0 ? 0 : 1)
}
