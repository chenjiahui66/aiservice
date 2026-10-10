import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useAuthStore } from '@/store/auth'

/**
 * 登录守卫：未登录时把用户送到登录页。
 * Tab 页与工作台子页共用；公开页（服务主页 / 预约）不使用。
 */
export function useAuthGuard(enabled = true): boolean {
  const token = useAuthStore((s) => s.token)
  const hydrated = useAuthStore((s) => s.hydrated)

  useEffect(() => {
    if (!enabled) return
    if (hydrated && !token) {
      Taro.navigateTo({ url: '/pages/auth/login/index' }).catch(() => {})
    }
  }, [enabled, token, hydrated])

  return !!token
}