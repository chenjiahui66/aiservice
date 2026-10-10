import type { UserConfigExport } from '@tarojs/cli'

/** 开发态：关闭压缩，保留 sourcemap，方便断点调试 */
const config: UserConfigExport<'webpack5'> = {
  env: {
    NODE_ENV: '"development"'
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