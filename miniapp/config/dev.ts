import type { UserConfigExport } from '@tarojs/cli'

/**
 * 开发态：关闭压缩，保留 sourcemap，方便断点调试
 */
const config: UserConfigExport<'webpack5'> = {
  env: {
    NODE_ENV: '"development"'
  },
  // ⚠️ 必须在 defineConstants 里显式声明，否则 process.env.TARO_APP_API_BASE
  //    不会被内联。小程序运行时没有 process 对象，会直接抛
  //    ReferenceError: process is not defined（构建能过，运行时才炸）。
  defineConstants: {
    'process.env.TARO_APP_API_BASE': JSON.stringify(
      process.env.TARO_APP_API_BASE || 'http://localhost:8080'
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