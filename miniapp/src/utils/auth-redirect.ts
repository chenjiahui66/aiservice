import Taro from '@tarojs/taro'

/**
 * 「跳登录页」的唯一入口。
 *
 * ── 为什么要统一 ────────────────────────────────────────────────
 * 之前有**两处**都会跳登录页：
 *   1. utils/request.ts —— 收到 401 / 40100 / 40101 时跳
 *   2. hooks/useAuthGuard.ts —— 发现没登录时跳
 * 两处都调 `Taro.navigateTo`，而 navigateTo 是**压栈**：
 * 一次未登录会压出**两个**登录页，退栈还会退回受保护页面。
 * 加上原来的去重标志 1200ms 就重置，第二次 401 落在窗口外照样再跳一次。
 *
 * 现在统一走这里，三重保险：
 *   1. 单例标志：同一次失效只触发一次跳转
 *   2. 已经在登录页就不跳（避免把登录页自己再压一个）
 *   3. 用 reLaunch 而不是 navigateTo：清空页面栈，栈里**永远只有一个**登录页
 *
 * ── 什么时候算「登录失效」 ──────────────────────────────────────
 * 只有「本次请求**带了** token 却被拒绝」才算失效。
 * 「本来就没登录」（比如页面在登录态恢复完成前就发了请求）不算 ——
 * 那种情况由 useAuthGuard 负责跳，否则两处都跳 = 跳两次。
 */

export const LOGIN_URL = '/pages/auth/login/index'
const LOGIN_ROUTE = LOGIN_URL.replace(/^\//, '')

/** 跳转中的标志；跳转完成后再冷却一小会儿，防止紧接着的第二个 401 再触发 */
let redirecting = false

/** 当前是否已经停在登录页 */
export function isOnLoginPage(): boolean {
  try {
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    const route = (current?.route || '').replace(/^\//, '')
    return route === LOGIN_ROUTE
  } catch {
    return false
  }
}

/**
 * 跳登录页（全局只会有一条路径）。
 *
 * @param options.toast 跳转前提示的文案；传 null 表示不提示
 */
export function redirectToLogin(options?: { toast?: string | null }): void {
  const toast = options?.toast === undefined ? '登录已失效，请重新登录' : options.toast

  // 已经在登录页了就不要再压一个
  if (isOnLoginPage()) {
    if (toast) Taro.showToast({ title: toast, icon: 'none', duration: 1500 })
    return
  }
  if (redirecting) return
  redirecting = true

  if (toast) {
    Taro.showToast({ title: toast, icon: 'none', duration: 1500 })
  }

  // 留一点时间让 toast 被看到，再清栈跳转
  setTimeout(() => {
    // 这 600ms 里可能已经自己跳到登录页了（例如用户手动点了「退出登录」），
    // 那就不要再跳一次，否则登录页会被无意义地重载。
    if (isOnLoginPage()) {
      redirecting = false
      return
    }
    Taro.reLaunch({
      url: LOGIN_URL,
      // reLaunch 失败（例如页面栈异常）时退回压栈
      fail: () => {
        Taro.navigateTo({ url: LOGIN_URL, fail: () => {} })
      },
      complete: () => {
        // 冷却：这段时间内的其它 401 不再重复跳
        setTimeout(() => {
          redirecting = false
        }, 1000)
      }
    })
  }, 600)
}
