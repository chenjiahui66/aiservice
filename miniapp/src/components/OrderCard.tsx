import { View, Text } from '@tarojs/components'
import type { OrderVO } from '@/types/domain'
import { OrderStatusTag } from './StatusTag'

interface OrderCardProps {
  order: OrderVO
  onClick?: (order: OrderVO) => void
}

/**
 * 订单卡片：突出「预约时间 / 地址 / 服务内容 / 状态」四要素，
 * 待确认订单额外给一条克制的待处理提示，便于发现但不刺眼。
 */
export default function OrderCard({ order, onClick }: OrderCardProps) {
  return (
    <View className='card card--tap' onClick={() => onClick?.(order)}>
      <View className='order-card__head'>
        <View className='row' style={{ gap: '16rpx' }}>
          <Text className='order-card__time'>{order.bookingSlot}</Text>
          <OrderStatusTag status={order.status} label={order.statusLabel} />
        </View>
        <Text className='muted'>{order.bookingDate}</Text>
      </View>

      <View className='order-card__meta'>
        <Text className='order-card__dot'>◎</Text>
        <Text className='grow'>{order.address || order.community || '—'}</Text>
      </View>

      <View className='order-card__meta'>
        <Text className='order-card__dot'>◇</Text>
        <Text className='grow'>
          {order.serviceName}
          {order.quantity ? ` × ${order.quantity}` : ''}
        </Text>
      </View>

      <View className='order-card__meta'>
        <Text className='order-card__dot'>○</Text>
        <Text className='grow'>{order.customerName}</Text>
        {order.customerPhone && <Text className='muted'>{order.customerPhone}</Text>}
      </View>

      {!!order.serviceDesc && <View className='order-card__desc'>{order.serviceDesc}</View>}
      {!!order.customerRemark && <View className='order-card__desc'>客户备注：{order.customerRemark}</View>}

      {order.status === 'PENDING_CONFIRM' && (
        <View className='order-card__pending'>
          <Text>●</Text>
          <Text>待你确认后才会安排服务</Text>
        </View>
      )}
    </View>
  )
}