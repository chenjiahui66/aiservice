import { useCallback, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import OrderCard from '@/components/OrderCard'
import { fetchBoard } from '@/api/provider'
import { usePageData } from '@/hooks/usePageData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { addDays, todayStr, weekdayLabel } from '@/utils/date'
import type { BoardVO, OrderVO } from '@/types/domain'

/**
 * 今日台账。
 * 突出「预约时间 / 地址 / 服务内容 / 状态」，待处理事项容易被发现但不用刺眼颜色。
 */
export default function BoardPage() {
  useAuthGuard()
  const [date, setDate] = useState(todayStr())

  const fetcher = useCallback(() => fetchBoard(date), [date])
  const { data, loading, error, reload } = usePageData<BoardVO>(fetcher, [date])

  // 最近 7 天横向切换，默认今天
  const days = Array.from({ length: 7 }, (_, i) => addDays(todayStr(), i))

  const goOrderDetail = (order: OrderVO) => {
    Taro.navigateTo({ url: `/pages/order-detail/index?id=${order.id}` })
  }

  const board = data
  const tasks = board?.tasks || []

  return (
    <View className='page'>
      <View className='hero'>
        <View className='row row--between'>
          <View>
            <View className='hero__title'>
              {date === todayStr() ? '今日台账' : `${date} 台账`}
            </View>
            <View className='hero__sub'>{weekdayLabel(date)}</View>
          </View>
          <View style={{ textAlign: 'right' }}>
            <View className='row' style={{ gap: '10rpx', justifyContent: 'flex-end' }}>
              {board && board.pendingConfirmCount > 0 && (
                <Text className='tag tag--pending'>{`${board.pendingConfirmCount} 待确认`}</Text>
              )}
            </View>
            <Text className='muted' style={{ display: 'block', marginTop: '8rpx' }}>
              {board ? `共 ${board.totalCount} 单` : ' '}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className='date-scroll' scrollX enableFlex style={{ marginBottom: '20rpx' }}>
        <View style={{ display: 'inline-flex' }}>
          {days.map((d) => {
            const on = d === date
            return (
              <View
                key={d}
                className={`date-chip ${on ? 'date-chip--on' : ''}`}
                onClick={() => setDate(d)}
              >
                <Text className='date-chip__label'>{d === todayStr() ? '今天' : d.slice(5)}</Text>
                <Text className='date-chip__week'>{weekdayLabel(d)}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>

      <PageState
        loading={loading}
        error={error}
        empty={!error && tasks.length === 0}
        emptyTitle='这一天还没有安排'
        emptyDesc='客户通过你的推广码下单后，会出现在这里。'
        skeleton
        onRetry={reload}
      >
        {board && (
          <View className='card'>
            <View className='stats'>
              <View className='stat'>
                <View
                  className={`stat__value ${
                    board.pendingConfirmCount > 0 ? 'stat__value--alert' : ''
                  }`}
                >
                  {board.pendingConfirmCount}
                </View>
                <View className='stat__label'>待确认</View>
              </View>
              <View className='stat'>
                <View className='stat__value'>{board.pendingServiceCount}</View>
                <View className='stat__label'>待服务</View>
              </View>
              <View className='stat'>
                <View className='stat__value'>{board.completedCount}</View>
                <View className='stat__label'>已完成</View>
              </View>
            </View>
            {board.cancelledCount > 0 && (
              <Text className='muted' style={{ display: 'block', textAlign: 'center' }}>
                另有 {board.cancelledCount} 单已取消
              </Text>
            )}
          </View>
        )}

        {tasks.map((order) => (
          <OrderCard key={order.id} order={order} onClick={goOrderDetail} />
        ))}

        <View
          className='fab'
          onClick={() => Taro.navigateTo({ url: '/pages/order-create/index' })}
        >
          ＋ 手动记单
        </View>
      </PageState>
    </View>
  )
}