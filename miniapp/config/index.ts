import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import devConfig from './dev'
import prodConfig from './prod'

/**
 * Taro 4 构建配置
 *
 * 说明：
 * - 小程序码能力（扫码、scene 解析）属于微信专属能力，其余平台在 src/platform/ 中做了降级适配。
 * - 接口域名通过 TARO_APP_API_BASE 注入，生产默认指向 https://community.aindgc.com。
 *
 * ⚠️ 这里**不要**在 baseConfig 里写 defineConstants: {}。
 *    merge 的对象合并对 defineConstants 是整体覆盖，空对象会把 prod.ts / dev.ts
 *    里的值顶掉，表现为产物里 process.env.TARO_APP_API_BASE 被替换成 0，
 *    BASE_URL 静默退回 localhost —— 构建不报错、真机却一片白屏，最难查的一种故障。
 *    要新增内联常量，请直接加到 prod.ts / dev.ts 各自的 defineConstants 里。
 */
export default defineConfig<'webpack5'>(async (merge, { command, mode }) => {
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'neighbor-service-miniapp',
    date: '2026-10-10',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    copy: {
      patterns: [],
      options: {}
    },
    framework: 'react',
    compiler: 'webpack5',
    cache: {
      enable: false
    },
    alias: {
      '@': require('path').resolve(__dirname, '..', 'src')
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false
        }
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false
        }
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})