import type { UserConfigExport } from '@tarojs/cli'

/**
 * 开发态配置。
 *
 * ⚠️ 这里**必须沿用 Taro 默认的 optimization**（不要关 splitChunks / runtimeChunk）。
 *
 * 原因：Taro 4 的小程序产物里，app / comp / 每个页面都是**独立的 webpack 入口**。
 * 一旦关掉 splitChunks，webpack 就会把共享依赖（尤其是 `@tarojs/runtime`）
 * **物理复制**进每一个入口文件。本项目实测过：
 *     dist 里 19 个 js 文件，**每个文件都有一份自己的 `Current = { app: null }`**。
 *
 * 而 `@tarojs/runtime` 的 `Current` 是整个框架的**单例**（`Current.app` 由
 * `createReactApp()` 赋值，页面 `onLoad` 时用它挂载 React 树）。
 * 页面那份副本没人赋值 → 永远是 null →
 *     TypeError: Cannot read property 'mount' of null
 *         at mount (@tarojs/runtime/dist/dsl/common.ts)
 *         at onLoad (@tarojs/runtime/dist/dsl/common.ts)
 * → 打开任何页面都白屏。
 *
 * Taro 默认的 splitChunks 会把 `@tarojs/runtime` 抽成公共 chunk（taro.js），
 * 配合 webpack 的全局 chunk 注册表（globalObject = wx），
 * 所有入口共用**同一份模块实例**，`Current` 才是唯一的。
 * 公共 chunk 之间用 `require("./taro.js")` 串联 —— 这是微信小程序官方支持的
 * CommonJS 能力（小程序 JS 文件里 require 其它 JS 文件），不是问题。
 *
 * 结论：**splitChunks 是 Taro 小程序能跑起来的前提，不要关。**
 */
const config: UserConfigExport<'webpack5'> = {
  env: {
    NODE_ENV: '"development"'
  },
  /**
   * ⚠️ 关闭「依赖预编译」（prebundle / module federation）。
   *
   * 开启时页面 chunk 会变成
   *     (wx.webpackJsonp = wx.webpackJsonp || []).push([[...], {...}])
   * 自身不 require 任何东西，react / @tarojs/taro 全部依赖
   * prebundle/remoteEntry.js 注册远程容器后才可解析。
   * 一旦容器注册与页面 push 的时序对不上，页面模块就永远不会被执行，
   * 表现为「白屏 + 只有底部 tabbar」（tabbar 是原生按 app.json 渲染的，不受影响）。
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
      // 默认打线上域名，开发者工具里开箱即用；
      // 要连本机后端时：$env:TARO_APP_API_BASE='http://localhost:8080' 再跑 npm run dev:weapp
      //process.env.TARO_APP_API_BASE || 'http://localhost:8080'
      'https://community.aindgc.com'
    )
  },
  mini: {
    webpackChain(chain) {
      chain.merge({
        optimization: {
          // 开发态不压缩，保留可读产物便于断点调试。
          // ⚠️ 这里**只**调 minimize，splitChunks / runtimeChunk 必须保持 Taro 默认值。
          minimize: false
        }
      })
    }
  }
}

export default config
