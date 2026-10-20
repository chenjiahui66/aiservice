import type { UserConfigExport } from '@tarojs/cli'

/**
 * 开发态：关闭压缩，保留 sourcemap，方便断点调试
 */
const config: UserConfigExport<'webpack5'> = {
  env: {
    NODE_ENV: '"development"'
  },
  /**
   * ⚠️ 开发态关闭「依赖预编译」（prebundle）。
   *
   * 开启时 dev 产物会走 module federation：页面 chunk 变成
   *     (wx.webpackJsonp = wx.webpackJsonp || []).push([[...], {...}])
   * 自身**不 require 任何东西**，react / @tarojs/taro / react-jsx-runtime
   * 全部依赖 prebundle/remoteEntry.js 注册远程容器后才可解析。
   * 一旦容器注册与页面 push 的时序对不上，页面模块就永远不会被执行，
   * 表现为「白屏 + 只有底部 tabbar」（tabbar 是原生按 app.json 渲染的，不受影响）。
   *
   * 关闭后 dev 与 prod 结构一致：依赖直接打进 app.js，页面自包含，不再有这个问题。
   * 代价只是首次编译略慢，对本地联调完全可接受。
   */
  compiler: {
    type: 'webpack5',
    prebundle: {
      enable: false
    }
  },
  // ⚠️ 必须在 defineConstants 里显式声明，否则 process.env.TARO_APP_API_BASE
  //    不会被内联。小程序运行时没有 process 对象，会直接抛
  //    ReferenceError: process is not defined（构建能过，运行时才炸）。
  defineConstants: {
    'process.env.TARO_APP_API_BASE': JSON.stringify(
      process.env.TARO_APP_API_BASE || 'https://community.aindgc.com'
    )
  },
  mini: {
    webpackChain(chain) {
      chain.merge({
        optimization: {
          minimize: false,
          // ⚠️⚠️ 这两项**必须关掉**，否则 watch 模式产出的包一打开就白屏。
          //
          // 关键：`taro build --type weapp --watch`（即 npm run dev:weapp）会被
          // Taro CLI 设成 NODE_ENV=development，走的正是**本文件**而不是 prod.ts。
          // 如果这里没关，Taro 的默认优化会开 splitChunks + runtimeChunk，
          // 把代码拆成 runtime / common / vendors / taro 四个独立 js，
          // 它们之间用 **CommonJS `require()`** 互连：
          //     require("./common"),require("./vendors"),
          //     require("./taro"),require("./runtime")
          // 而**微信小程序运行时没有 require 这个全局对象**，第一行就抛
          // `require is not defined` → 纯白屏，且没有任何业务报错。
          //
          // 之前只在 prod.ts 里关过，导致「dev 跑得好好的、一用 build:weapp 上传就白屏」。
          // 现在 dev / prod 两边都关，并由 tests/check-miniapp-dist.cjs 断言，
          // 以后再改漏一边会直接挂。
          //
          // 代价：所有代码进一个 app.js，无法并行加载。对本项目完全可接受。
          // 将来包体真需要分包，用小程序原生分包（app.config.ts 的 subPackages），
          // 而不是打开 webpack 的 splitChunks。
          splitChunks: false,
          runtimeChunk: false
        }
      })
    }
  }
}

export default config