import { Text } from '@tarojs/components'
import type { AuditStatus, OrderStatus } from '@/types/domain'

const ORDER_TAG_CLASS: Record<OrderStatus, string> = {
  PENDING_CONFIRM: 'tag tag--pending',
  CONFIRMED: 'tag tag--confirmed',
  SERVING: 'tag tag--serving',
  COMPLETED: 'tag tag--completed',
  CANCELLED: 'tag tag--cancelled'
}

/** 订单状态标签：颜色克制，仅「待确认」用琥珀色提示需要处理 */
export function OrderStatusTag({ status, label }: { status: OrderStatus; label: string }) {
  return <Text className={ORDER_TAG_CLASS[status] || 'tag'}>{label}</Text>
}

const AUDIT_TAG_CLASS: Record<AuditStatus, string> = {
  PENDING: 'tag tag--pending',
  APPROVED: 'tag tag--completed',
  REJECTED: 'tag tag--danger'
}

/** 审核状态标签 */
export function AuditStatusTag({ status, label }: { status: AuditStatus; label: string }) {
  return <Text className={AUDIT_TAG_CLASS[status] || 'tag'}>{label}</Text>
}