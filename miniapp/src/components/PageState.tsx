import { View, Text, Button } from '@tarojs/components'

interface PageStateProps {
  /** 是否加载中 */
  loading?: boolean
  /** 请求失败信息 */
  error?: string | null
  /** 错误标题：不传则直接显示 error 文案 */
  errorTitle?: string
  /** 错误补充说明 */
  errorDesc?: string
  /** 是否空数据 */
  empty?: boolean
  emptyTitle?: string
  emptyDesc?: string
  /** 加载中时是否显示骨架屏 */
  skeleton?: boolean
  /** 重试回调 */
  onRetry?: () => void
  children?: React.ReactNode
}

/**
 * 页面状态容器：统一处理「加载中 / 空数据 / 请求失败」三种非内容态。
 * 网络异常与业务失败都由 request 层转成 error 文案传入这里。
 */
export default function PageState({
  loading,
  error,
  errorTitle,
  errorDesc,
  empty,
  emptyTitle = '暂无数据',
  emptyDesc,
  skeleton,
  onRetry,
  children
}: PageStateProps) {
  if (loading) {
    if (skeleton) {
      return (
        <View className='card'>
          <View className='skeleton-row' style={{ width: '45%' }} />
          <View className='skeleton-row' style={{ width: '85%' }} />
          <View className='skeleton-row' style={{ width: '70%' }} />
          <View className='skeleton-row' style={{ width: '55%', marginBottom: '0' }} />
        </View>
      )
    }
    return (
      <View className='state'>
        <Text className='state__glyph'>⋯</Text>
        <Text className='state__title'>加载中…</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View className='state'>
        <Text className='state__glyph'>⚠</Text>
        <Text className='state__title'>{errorTitle || error}</Text>
        {!!errorDesc && <Text className='state__desc'>{errorDesc}</Text>}
        {!!onRetry && (
          <Button className='btn btn--ghost state__retry' onClick={onRetry}>
            重新加载
          </Button>
        )}
      </View>
    )
  }

  if (empty) {
    return (
      <View className='state'>
        <Text className='state__glyph'>○</Text>
        <Text className='state__title'>{emptyTitle}</Text>
        {!!emptyDesc && <Text className='state__desc'>{emptyDesc}</Text>}
      </View>
    )
  }

  return <>{children}</>
}