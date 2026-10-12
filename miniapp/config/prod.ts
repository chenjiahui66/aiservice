import type { UserConfigExport } from '@tarojs/cli'

/**
 * 生产态后端地址。
 *
 * 优先取环境变量 TARO_APP_API_BASE；未设置时回落到本机并**大声告警**。
 *
 * 这里刻意不硬失败：后端地址写错是「连不上」这种立刻可见的配置失误，
 * 与「用弱签名密钥」那种静默可利用的安全漏洞不同，
 * 不该用阻断构建的方式防御——那只会逼着人随手填一个假域名。
 */
function resolveApiBase(): string {
  const base = process.env.TARO_APP_API_BASE
  if (base) return base

  console.warn(
    '\n' +
      '┌────────────────────────────────────────────────────────┐\n' +
      '│ ⚠️  未设置 TARO_APP_API_BASE                            │\n' +
      '│    本次构建的后端地址为 http://localhost:8080           │\n' +
      '│    上传体验版 / 正式发布前必须指定真实域名：             │\n' +
      '│      set TARO_APP_API_BASE=https://api.example.com       │\n' +
      '│      npm run build:weapp                                 │\n' +
      '└────────────────────────────────────────────────────────┘\n'
  )
  return 'http://localhost:8080'
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
          minimize: true
        }
      })
    }
  }
}

export default config