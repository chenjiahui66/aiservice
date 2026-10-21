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
  /**
   * ⚠️ 关闭「依赖预编译」（prebundle / module federation）。
   *
   * 开启时页面 chunk 会变成
   *     (wx.webpackJsonp = wx.webpackJsonp || []).push([[...], {...}])
   * 自身不 require 任何东西，react / @tarojs/taro 全部依赖
   * prebundle/remoteEntry.js 注册远程容器后才可解析。
   * 容器注册与页面 push 的时序对不上时，页面模块永远不会被执行 →
   * 打开就是「白屏 + 只有底部 tabbar」（tabbar 由 app.json 原生渲染，不受影响）。
   */
  compiler: {
    type: 'webpack5',
    prebundle: {
      enable: false
    }
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
          // ⚠️⚠️ 这里**只能**调 minimize，splitChunks / runtimeChunk 必须保持 Taro 默认值。
          //
          // 原因：Taro 4 的小程序产物里，app / comp / 每个页面都是**独立的 webpack 入口**。
          // 一旦关掉 splitChunks，webpack 会把共享依赖（尤其是 `@tarojs/runtime`）
          // **物理复制**进每一个入口文件。本项目实测：19 个 js 文件里
          // 每个都有一份自己的 `Current = { app: null }`。
          //
          // 而 `Current` 是 @tarojs/runtime 的**单例**：
          //   - `Current.app` 由 `createReactApp()` 赋值（只在 app.js 那一份里执行）
          //   - 页面 `onLoad` 时用 `Current.app.mount(...)` 挂载 React 树
          // 页面那份副本没人赋值 → 恒为 null →
          //     TypeError: Cannot read property 'mount' of null
          //         at mount  (@tarojs/runtime/dist/dsl/common.ts)
          //         at onLoad (@tarojs/runtime/dist/dsl/common.ts)
          // → 打开任何页面都白屏。
          //
          // Taro 默认的 splitChunks 会把 `@tarojs/runtime` 抽成公共 chunk（taro.js），
          // 配合 webpack 的全局 chunk 注册表（globalObject = wx），
          // 所有入口共用**同一份模块实例**，`Current` 才是唯一的。
          // 公共 chunk 之间用 `require("./taro.js")` 串联 —— 这是微信小程序官方支持的
          // CommonJS 能力（小程序 JS 文件里可以 require 其它 JS 文件），不是问题。
          //
          // 结论：**splitChunks 是 Taro 小程序能跑起来的前提，不要关。**
        }
      })
    }
  }
}

export default config
