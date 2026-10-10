import { useCallback, useEffect, useRef, useState } from 'react'
import { BizError, NetError } from '@/utils/request'

interface PageDataState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  setData: (updater: T | ((prev: T | null) => T)) => void
}

/**
 * 页面数据加载。
 * 统一产出 loading / error / data 三态，配合 PageState 组件渲染，
 * 保证每个页面都处理了「加载中 / 请求失败 / 空数据」。
 */
export function usePageData<T>(fetcher: () => Promise<T>, deps: unknown[] = []): PageDataState<T> {
  const [data, setDataState] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      if (!alive.current) return
      setDataState(result)
    } catch (e) {
      if (!alive.current) return
      setError(toMessage(e))
      setDataState(null)
    } finally {
      if (alive.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload])

  const setData = useCallback((updater: T | ((prev: T | null) => T)) => {
    setDataState((prev) => (typeof updater === 'function' ? (updater as (p: T | null) => T)(prev) : updater))
  }, [])

  return { data, loading, error, reload, setData }
}

/** 把异常转换成可展示的文案 */
export function toMessage(e: unknown): string {
  if (e instanceof NetError) return e.message
  if (e instanceof BizError) return e.message
  if (e instanceof Error) return e.message
  return '操作失败，请稍后重试'
}