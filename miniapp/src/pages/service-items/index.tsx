import { useCallback, useEffect, useState } from 'react'
import { View, Text, Switch } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import { fetchMyServiceItems, selectServiceItem, unselectServiceItem } from '@/api/provider'
import { usePageData, toMessage } from '@/hooks/usePageData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import type { MyServiceItem } from '@/types/domain'

/**
 * 我的服务类目。
 *
 * 类目全部由平台后台维护，服务者**不能自建** —— 只能从平台那批里挑
 * 自己提供哪几项。挑了主页上才出现，客户扫推广码进来看到的也是这几项；
 * 不提供的可以取消，取消后随时能加回来（记录不会被删掉）。
 */
export default function ServiceItemsPage() {
  useAuthGuard()

  const fetcher = useCallback(() => fetchMyServiceItems(), [])
  const { data, loading, error, reload } = usePageData<MyServiceItem[]>(fetcher, [], {
    refreshOnShow: true
  })

  // 本地快照：切换时先乐观更新，接口失败再回滚，避免开关「咔哒」半天不动
  const [rows, setRows] = useState<MyServiceItem[]>([])
  const [pending, setPending] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (data) setRows(data)
  }, [data])

  const selectedCount = rows.filter((r) => r.selected).length

  const onToggle = async (item: MyServiceItem, next: boolean) => {
    if (pending[item.templateId]) return
    setPending((p) => ({ ...p, [item.templateId]: true }))
    setRows((prev) =>
      prev.map((r) => (r.templateId === item.templateId ? { ...r, selected: next } : r))
    )
    try {
      if (next) {
        await selectServiceItem(item.templateId)
      } else {
        await unselectServiceItem(item.templateId)
      }
      Taro.showToast({
        title: next ? '已添加这项服务' : '已移除这项服务',
        icon: 'none',
        duration: 1200
      })
    } catch (e) {
      // 回滚开关状态，别让界面显示的和服务端不一致
      setRows((prev) =>
        prev.map((r) => (r.templateId === item.templateId ? { ...r, selected: !next } : r))
      )
      Taro.showToast({ title: toMessage(e), icon: 'none' })
    } finally {
      setPending((p) => {
        const nextPending = { ...p }
        delete nextPending[item.templateId]
        return nextPending
      })
    }
  }

  return (
    <View className='page'>
      <PageState loading={loading} error={error} skeleton onRetry={reload}>
        <View>
          <View className='notice notice--info' style={{ marginBottom: '20rpx' }}>
            <Text className='notice__icon'>ⓘ</Text>
            <Text>
              服务类目由平台统一维护，你只要挑自己提供哪几项。客户扫你的推广码时，只会看到你勾选的服务。
            </Text>
          </View>

          {rows.length === 0 ? (
            <View className='card'>
              <Text className='muted'>平台还没有配置任何服务类目，请联系平台添加。</Text>
            </View>
          ) : (
            <View className='card'>
              <View className='service-item-toggle__summary'>
                <Text className='muted'>已选 {selectedCount} / {rows.length} 项</Text>
                <Text className='muted'>只影响主页展示</Text>
              </View>

              {rows.map((item) => (
                <View key={item.templateId} className='service-item-toggle'>
                  <View className='grow'>
                    <View className='row row--between'>
                      <Text className='service-item-toggle__name'>{item.name}</Text>
                      {!item.platformEnabled && <Text className='tag tag--pending'>平台已停用</Text>}
                    </View>

                    {!!item.description && (
                      <View className='service-item__desc'>{item.description}</View>
                    )}

                    <View className='service-item-toggle__meta'>
                      {item.unitDesc || item.priceDesc ? (
                        <Text className='muted'>
                          {[item.unitDesc, item.priceDesc].filter(Boolean).join(' · ')}
                        </Text>
                      ) : (
                        <Text className='muted'>平台未设置单位与价格</Text>
                      )}
                    </View>
                  </View>

                  <Switch
                    className='service-item-toggle__switch'
                    checked={item.selected}
                    disabled={!item.platformEnabled || pending[item.templateId]}
                    color='#2B6CF0'
                    onChange={(e) => onToggle(item, e.detail.value)}
                  />
                </View>
              ))}
            </View>
          )}

          {selectedCount === 0 && rows.length > 0 && (
            <View className='notice' style={{ marginTop: '20rpx' }}>
              <Text className='notice__icon'>⚠</Text>
              <Text>一项都没选的话，客户扫你的码会看到「该服务者暂未开放可预约的服务项目」。</Text>
            </View>
          )}

          <View className='footer-spacer' />
        </View>
      </PageState>
    </View>
  )
}
