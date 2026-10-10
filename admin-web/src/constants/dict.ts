/**
 * 后端枚举的中文展示映射。
 * 这些是 UI 文案，不是业务数据；列表里的所有统计值仍一律来自接口。
 */
import type {
  AuditStatus,
  ComplaintStatus,
  ComplaintType,
  EnabledStatus,
  OrderStatus
} from '@/types/admin'

export type TagType = 'success' | 'info' | 'warning' | 'danger' | 'primary'

export const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  SUSPENDED: '已暂停'
}

export const AUDIT_STATUS_TAG: Record<AuditStatus, TagType> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUSPENDED: 'info'
}

export const ENABLED_LABEL: Record<EnabledStatus, string> = {
  ENABLED: '启用中',
  DISABLED: '已停用'
}

export const ENABLED_TAG: Record<EnabledStatus, TagType> = {
  ENABLED: 'success',
  DISABLED: 'info'
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_CONFIRM: '待确认',
  CONFIRMED: '已预约',
  SERVING: '服务中',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
}

export const ORDER_STATUS_TAG: Record<OrderStatus, TagType> = {
  PENDING_CONFIRM: 'warning',
  CONFIRMED: 'primary',
  SERVING: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'info'
}

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = (
  Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]
).map((value) => ({ value, label: ORDER_STATUS_LABEL[value] }))

export const AUDIT_STATUS_OPTIONS: { value: AuditStatus; label: string }[] = (
  Object.keys(AUDIT_STATUS_LABEL) as AuditStatus[]
).map((value) => ({ value, label: AUDIT_STATUS_LABEL[value] }))

export const ENABLED_OPTIONS: { value: EnabledStatus; label: string }[] = (
  Object.keys(ENABLED_LABEL) as EnabledStatus[]
).map((value) => ({ value, label: ENABLED_LABEL[value] }))

export const COMPLAINT_TYPE_LABEL: Record<ComplaintType, string> = {
  COMPLAINT: '客户投诉',
  FEEDBACK: '用户反馈',
  VIOLATION: '违规举报'
}

export const COMPLAINT_TYPE_OPTIONS: { value: ComplaintType; label: string }[] = (
  Object.keys(COMPLAINT_TYPE_LABEL) as ComplaintType[]
).map((value) => ({ value, label: COMPLAINT_TYPE_LABEL[value] }))

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  CLOSED: '已关闭'
}

export const COMPLAINT_STATUS_TAG: Record<ComplaintStatus, TagType> = {
  PENDING: 'danger',
  PROCESSING: 'warning',
  CLOSED: 'info'
}

export const COMPLAINT_STATUS_OPTIONS: {
  value: ComplaintStatus
  label: string
}[] = (Object.keys(COMPLAINT_STATUS_LABEL) as ComplaintStatus[]).map((value) => ({
  value,
  label: COMPLAINT_STATUS_LABEL[value]
}))

export const ORDER_SOURCE_LABEL: Record<string, string> = {
  QR_CODE: '扫码预约',
  MANUAL: '手动记单'
}

export const ORDER_CHANNEL_LABEL: Record<string, string> = {
  DIRECT: '直接访问',
  WECHAT_MOMENTS: '朋友圈',
  WECHAT_CHAT: '微信聊天',
  OTHER: '其它'
}

export const OPERATOR_TYPE_LABEL: Record<string, string> = {
  ADMIN: '管理员',
  PROVIDER: '服务者',
  CUSTOMER: '客户',
  SYSTEM: '系统'
}
