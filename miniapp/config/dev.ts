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
      //process.env.TARO_APP_API_BASE || 'http://localhost:8080'
      'https://community.aindgc.com'
    )
  },
  mini: {
    webpackChain(chain) {
      chain.merge({
        optimization: {
          minimize: false
        }
      })
    }
  }
}

export default config