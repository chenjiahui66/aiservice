import type { UserConfigExport } from '@tarojs/cli'

/** 生产态：压缩代码，减小包体积 */
const config: UserConfigExport<'webpack5'> = {
  env: {
    NODE_ENV: '"production"'
  },
  mini: {
    webpackChain(chain) {
      chain.merge({
        optimization: {
          minimize: true
        }
      })
    }
  }
}

export default config