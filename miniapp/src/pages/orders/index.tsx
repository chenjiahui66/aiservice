import { useCallback, useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import OrderCard from '@/components/OrderCard'
import { fetchOrders } from '@/api/provider'
import { usePageData } from '@/hooks/usePageData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import type { OrderStatus, OrderVO } from '@/types/domain'

const PAGE_SIZE = 20

/** 状态筛选项：值直接对应后端 status 枚举 */
const STATUS_TABS: Array<{ key: OrderStatus | ''; label: string }> = [
  { key: '', label: '全部' },
  { key: 'PENDING_CONFIRM', label: '待确认' },
  { key: 'CONFIRMED', label: '已预约' },
  { key: 'SERVING', label: '服务中' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'CANCELLED', label: '已取消' }
]

/** 全部订单：按状态筛选 + 关键字搜索 + 上拉分页 */
export default function OrdersPage() {
  useAuthGuard()
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [keyword, setKeyword] = useState('')
  const [submittedKeyword, setSubmittedKeyword] = useState('')
  const [page, setPage] = useState(1)

  const fetcher = useCallback(
    () =>
      fetchOrders({
        status: status || undefined,
        keyword: submittedKeyword || undefined,
        page,
        size: PAGE_SIZE
      }),
    [status, submittedKeyword, page]
  )
  const { data, loading, error, reload } = usePageData(fetcher, [status, submittedKeyword, page])

  const records = data?.records || []
  const total = data?.total || 0

  const applyStatus = (key: OrderStatus | '') => {
    setStatus(key)
    setPage(1)
  }

  const doSearch = () => {
    setSubmittedKeyword(keyword.trim())
    setPage(1)
  }

  const clearSearch = () => {
    setKeyword('')
    setSubmittedKeyword('')
    setPage(1)
  }

  const loadMore = () => {
    if (loading) return
    if (records.length < total) setPage(page + 1)
  }

  const goDetail = (order: OrderVO) => {
    Taro.navigateTo({ url: `/pages/order-detail/index?id=${order.id}` })
  }

  return (
    <View className='page'>
      <View className='searchbar'>
        <Text className='muted'>搜索</Text>
        <Input
          className='searchbar__input'
          value={keyword}
          placeholder='客户姓名 / 手机号 / 订单号 / 地址'
          placeholderClass='form-item__placeholder'
          confirmType='search'
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={doSearch}
        />
        {submittedKeyword ? (
          <Text className='link' onClick={clearSearch}>
            清除
          </Text>
        ) : (
          <Text className='link' onClick={doSearch}>
            搜索
          </Text>
        )}
      </View>

      <ScrollView className='filters' scrollX enableFlex style={{ marginBottom: '20rpx' }}>
        <View className='filters__inner'>
          {STATUS_TABS.map((tab) => (
            <View
              key={tab.key || 'all'}
              className={`filter-chip ${status === tab.key ? 'filter-chip--on' : ''}`}
              onClick={() => applyStatus(tab.key)}
            >
              {tab.label}
            </View>
          ))}
        </View>
      </ScrollView>

      <View className='section-head'>
        <Text className='section-head__title'>订单</Text>
        <Text className='muted'>{loading ? '加载中…' : `共 ${total} 单`}</Text>
      </View>

      <PageState
        loading={loading && page === 1}
        error={error}
        empty={!error && records.length === 0}
        emptyTitle={submittedKeyword ? '没有匹配的订单' : '还没有订单'}
        emptyDesc={
          submittedKeyword
            ? '换个关键字，或清除筛选条件试试。'
            : '客户扫码下单后会出现在这里，你也可以手动记单。'
        }
        skeleton={page === 1}
        onRetry={reload}
      >
        {records.map((order) => (
          <OrderCard key={order.id} order={order} onClick={goDetail} />
        ))}
        {records.length > 0 && (
          <View className='loadmore' onClick={loadMore}>
            {records.length < total ? '点击加载更多' : '没有更多了'}
          </View>
        )}
      </PageState>

      <View className='fab' onClick={() => Taro.navigateTo({ url: '/pages/order-create/index' })}>
        ＋ 手动记单
      </View>
    </View>
  )
}