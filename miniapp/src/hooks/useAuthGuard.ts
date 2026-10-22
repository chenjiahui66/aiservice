import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { redirectToLogin } from '@/utils/auth-redirect'

/**
 * 登录守卫：未登录时把用户送到登录页。
 * Tab 页与工作台子页共用；公开页（服务主页 / 预约）不使用。
 *
 * 跳转统一交给 utils/auth-redirect：
 *   - 全局单例，同一次失效只会跳一次
 *   - 用 reLaunch 清栈，页面栈里永远只有一个登录页
 *   - 已经在登录页就不再跳
 */
export function useAuthGuard(enabled = true): boolean {
  const token = useAuthStore((s) => s.token)
  const hydrated = useAuthStore((s) => s.hydrated)

  useEffect(() => {
    if (!enabled) return
    // hydrated 之前不下判断：本地存储里的登录态还没恢复，
    // 这时候 token 一定是空的，会把已登录用户误判成未登录。
    if (hydrated && !token) {
      redirectToLogin({ toast: null })
    }
  }, [enabled, token, hydrated])

  return !!token
}
