import type { UserConfigExport } from '@tarojs/cli'

/**
 * 生产态后端地址。
 *
 * 默认指向线上域名 https://community.aindgc.com —— 生产构建**开箱即用**，
 * 不需要先设环境变量。仍可用 TARO_APP_API_BASE 覆盖（比如临时指向预发环境）。
 *
 * 为什么给默认值而不是留空：
 *   未设置时回落到 localhost 的话，构建能过、上传体验版才发现连不上，
 *   而那种问题在真机上表现为「一直转圈」，很难一眼看出是地址配错。
 *   域名是这个项目的固定部署目标，写死在这里比每次构建都记得设环境变量更可靠。
 *
 * ⚠️ 上传前必须确认微信后台已配置 request 合法域名：
 *     https://community.aindgc.com
 *    没配的话请求会在**微信层**被拦掉，压根发不出去，
 *    开发者工具的 Network 面板什么都看不到 —— 极易误判成代码问题。
 *    本地调试可在开发者工具勾选「不校验合法域名」。
 */
const DEFAULT_API_BASE = 'https://community.aindgc.com'

function resolveApiBase(): string {
  const base = process.env.TARO_APP_API_BASE
  // 环境变量优先；为空或全是空格也回落，避免拼出 " https://..." 这种废地址
  if (base && base.trim()) return base.trim()

  console.warn(
    '\n' +
      '┌────────────────────────────────────────────────────────┐\n' +
      '│ ℹ️  未设置 TARO_APP_API_BASE，使用默认生产地址              │\n' +
      `│    ${DEFAULT_API_BASE.padEnd(54)}│\n` +
      '│    要指向别的环境：                                       │\n' +
      '│      set TARO_APP_API_BASE=https://staging.example.com    │\n' +
      '│      npm run build:weapp                                  │\n' +
      '└────────────────────────────────────────────────────────┘\n'
  )
  return DEFAULT_API_BASE
}

/** 生产态：压缩代码，减小包体积 */
const config: UserConfigExport<'webpack5'> = {
  env: {
    NODE_ENV: '"production"'
  },
  // ⚠️ 必须显式声明，否则 process.env.TARO_APP_API_BASE 不会被内联。
  //    小程序运行时没有 process 对象，运行时直接抛
  //    ReferenceError: process is not defined（构建能过，启动才炸）。
  defineConstants: {
    'process.env.TARO_APP_API_BASE': JSON.stringify(resolveApiBase())
  },
  mini: {
    webpackChain(chain) {
      chain.merge({
        optimization: {
          minimize: true,
          // ⚠️⚠️ 这两项**必须关掉**，否则生产包一打开就白屏。
          //
          // 症状：`npm run dev:weapp` 正常，`npm run build:weapp` 白屏，
          //        且 Console 里没有业务报错，只有 wx 引擎层的静默失败。
          //
          // 原因：Taro 的默认优化会开 splitChunks + runtimeChunk，把代码拆成
          //        runtime / common / vendors / taro 四个独立 js。webpack 产物之间
          //        用 **CommonJS `require()`** 互连，于是 app.js 开头就是：
          //            require("./common"),require("./vendors"),
          //            require("./taro"),require("./runtime"),...
          //        而**微信小程序运行时没有 require 这个全局对象**，第一行就抛
          //        `require is not defined`，整个 App 起不来 → 纯白屏。
          //
          // 为什么 dev 不炸：dev 模式不做这套 chunk 拆分，产物是单文件，
          //        走 wx.webpackJsonp 机制（微信原生支持）而非 CommonJS。
          //
          // 关掉后的代价：所有代码进一个 app.js，**无法并行加载**，
          // 首屏字节数略增。对本项目（几十 KB 量级）完全可接受，
          // 换来的是生产包一定能跑起来。
          //
          // 如果将来包体真的大到需要分包，正确做法是用小程序原生分包
          // （app.config.ts 的 subPackages），而不是打开 webpack 的 splitChunks。
          splitChunks: false,
          runtimeChunk: false
        }
      })
    }
  }
}

export default config