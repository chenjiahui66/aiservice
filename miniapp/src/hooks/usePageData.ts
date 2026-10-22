import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { useAuthStore } from '@/store/auth'
import { BizError, NetError } from '@/utils/request'

interface PageDataState<T> {
  data: T | null
  loading: boolean
  error: string | null
  /**
   * 业务错误码；网络异常 / 非 BizError 时为 null。
   * 页面可据此区分「重试有用」（网络抖动）和「重试没用」
   * （例如 41008 主页已关闭 —— 客户点多少次重试都没用）。
   */
  errorCode: number | null
  reload: () => Promise<void>
  setData: (updater: T | ((prev: T | null) => T)) => void
}

export interface PageDataOptions {
  /**
   * 页面重新显示时是否刷新。
   *
   * 微信会缓存 tab 页，切换走再切回来时页面不会重新加载，
   * 数据就停在旧状态。tab 页（台账 / 订单 / 客户 / 推广）打开这个。
   */
  refreshOnShow?: boolean
}

/**
 * 页面数据加载。
 * 统一产出 loading / error / data 三态，配合 PageState 组件渲染，
 * 保证每个页面都处理了「加载中 / 请求失败 / 空数据」。
 *
 * ── 什么时候重新拉数据 ──────────────────────────────────────────
 * 1. 首次挂载 —— 但必须**等登录态恢复完**（hydrated）再拉。
 *    以前不等，于是页面带着空 token 去请求 → 拿到 401 → 页面卡在错误态，
 *    用户看到的现象就是「登录后各个 tab 页状态没刷新，要手动点重新加载才对」。
 * 2. 登录态变化 —— 登录 / 登出 / 换号后自动重拉，页面状态立刻跟上。
 * 3. 页面重新显示 —— 见 refreshOnShow。
 */
export function usePageData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: PageDataOptions = {}
): PageDataState<T> {
  const [data, setDataState] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<number | null>(null)
  const alive = useRef(true)

  // 登录态：hydrated 之前不能发请求（token 还没从本地存储恢复出来）
  const token = useAuthStore((s) => s.token)
  const hydrated = useAuthStore((s) => s.hydrated)
  const { refreshOnShow = false } = options

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorCode(null)
    try {
      const result = await fetcher()
      if (!alive.current) return
      setDataState(result)
    } catch (e) {
      if (!alive.current) return
      setError(toMessage(e))
      setErrorCode(e instanceof BizError ? e.code : null)
      setDataState(null)
    } finally {
      if (alive.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, token])

  /**
   * 上面的 effect 每拉一次数据就置位，用于和「页面重新显示」去重：
   * 登录后 token 变化会触发一次重拉，紧接着 switchTab 回来又触发一次显示，
   * 不去重就会连发两个请求。
   */
  const fetchedByEffect = useRef(false)
  useEffect(() => {
    // 登录态还没恢复完 —— 等 hydrate 之后再拉，否则请求不带 token
    if (!hydrated) return
    fetchedByEffect.current = true
    reload()
  }, [reload, hydrated])

  // 页面重新显示时刷新（tab 切回来、登录后切回台账）
  const shownOnce = useRef(false)
  Taro.useDidShow(() => {
    if (!refreshOnShow) return
    const isFirstShow = !shownOnce.current
    shownOnce.current = true
    // 首次显示：上面的 effect 已经拉过了
    if (isFirstShow) {
      fetchedByEffect.current = false
      return
    }
    // 登录态刚变过：上面的 effect 已经拉过了，不重复拉
    if (fetchedByEffect.current) {
      fetchedByEffect.current = false
      return
    }
    reload()
  })

  const setData = useCallback((updater: T | ((prev: T | null) => T)) => {
    setDataState((prev) => (typeof updater === 'function' ? (updater as (p: T | null) => T)(prev) : updater))
  }, [])

  return { data, loading, error, errorCode, reload, setData }
}

/** 把异常转换成可展示的文案 */
export function toMessage(e: unknown): string {
  if (e instanceof NetError) return e.message
  if (e instanceof BizError) return e.message
  if (e instanceof Error) return e.message
  return '操作失败，请稍后重试'
}
