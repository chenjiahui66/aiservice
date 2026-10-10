/**
 * 管理端业务类型，逐字段对应 docs/API.md 与后端 AdminDto / OrderDto。
 * 后端 enum 一律以字符串 code 下发，这里用字面量联合收窄。
 */

/** 服务者审核状态（后端 AuditStatus）。 */
export type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'

/** 启停状态（后端 EnabledStatus，VO 中以字符串下发）。 */
export type EnabledStatus = 'ENABLED' | 'DISABLED'

/** 订单状态（后端 OrderStatus）。 */
export type OrderStatus =
  | 'PENDING_CONFIRM'
  | 'CONFIRMED'
  | 'SERVING'
  | 'COMPLETED'
  | 'CANCELLED'

/** 投诉类型（后端 ComplaintType）。 */
export type ComplaintType = 'COMPLAINT' | 'FEEDBACK' | 'VIOLATION'

/** 投诉处理状态（后端 ComplaintStatus）。 */
export type ComplaintStatus = 'PENDING' | 'PROCESSING' | 'CLOSED'

// ---------------------------------------------------------------- 认证

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  tokenType: string
  /** 管理员登录时为 null。 */
  providerId: number | null
  displayName: string | null
  username: string
  auditStatus: string | null
  auditRemark: string | null
  expiresInSeconds: number
}

// ---------------------------------------------------------------- 概览

export interface TrendPoint {
  date: string
  count: number
}

export interface DashboardVO {
  totalProviders: number
  pendingAuditProviders: number
  approvedProviders: number
  disabledProviders: number
  totalUsers: number
  totalOrders: number
  pendingConfirmOrders: number
  servingOrders: number
  completedOrders: number
  cancelledOrders: number
  totalCustomers: number
  pendingComplaints: number
  totalVisits: number
  /** 近 7 日订单量趋势。 */
  orderTrend: TrendPoint[] | null
  wechatCodeMode: string | null
}

// ---------------------------------------------------------------- 服务者

export interface ProviderListVO {
  id: number
  userId: number
  realName: string | null
  phone: string | null
  serviceArea: string | null
  auditStatus: AuditStatus | null
  auditStatusLabel: string | null
  enabled: EnabledStatus | null
  referralCode: string | null
  orderCount: number
  customerCount: number
  createdAt: string | null
  auditedAt: string | null
}

export interface ProviderQuery {
  keyword?: string
  auditStatus?: AuditStatus | ''
  enabled?: EnabledStatus | ''
  page?: number
  size?: number
}

export interface AuditRequest {
  approved: boolean
  remark?: string
  toggleEnabled?: boolean
}

export interface StatusRequest {
  enabled: boolean
  reason?: string
}

// ---------------------------------------------------------------- 服务项目 / 主页模板

export interface ServiceItemVO {
  id: number
  /** 为空表示平台级模板，否则为服务者自建项引用该模板。 */
  templateId: number | null
  name: string | null
  description: string | null
  iconUrl: string | null
  unitDesc: string | null
  priceDesc: string | null
  /** JSON 字符串，服务主页表单字段模板。 */
  formFields: string | null
  /** JSON 字符串，预约时段规则模板。 */
  bookingRules: string | null
  notes: string | null
  sortOrder: number | null
  enabled: EnabledStatus | null
}

export interface ServiceItemSaveRequest {
  name?: string
  description?: string
  iconUrl?: string
  unitDesc?: string
  priceDesc?: string
  formFields?: string
  bookingRules?: string
  notes?: string
  sortOrder?: number
  enabled?: boolean
}

// ---------------------------------------------------------------- 订单（只读）

export interface OrderLogVO {
  action: string | null
  actionLabel: string | null
  fromStatus: OrderStatus | null
  toStatus: OrderStatus | null
  remark: string | null
  operatorType: string | null
  operatorName: string | null
  createdAt: string | null
}

export interface OrderVO {
  id: number
  orderNo: string | null
  customerId: number | null
  customerName: string | null
  customerPhone: string | null
  community: string | null
  address: string | null
  serviceName: string | null
  quantity: number | null
  serviceDesc: string | null
  customerRemark: string | null
  providerNote: string | null
  bookingDate: string | null
  bookingSlot: string | null
  status: OrderStatus | null
  statusLabel: string | null
  source: string | null
  channel: string | null
  cancelReason: string | null
  confirmedAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string | null
  logs: OrderLogVO[] | null
}

export interface OrderQuery {
  dateFrom?: string
  dateTo?: string
  status?: OrderStatus | ''
  keyword?: string
  serviceItemId?: number
  page?: number
  size?: number
}

// ---------------------------------------------------------------- 投诉

/** 后端以 Map<String,Object> 下发，key 固定，见 AdminService#complaints。 */
export interface ComplaintRecord {
  id: number
  providerId: number | null
  orderId: number | null
  customerName: string | null
  customerPhone: string | null
  type: ComplaintType | null
  content: string | null
  status: ComplaintStatus | null
  handleRemark: string | null
  createdAt: string | null
}

export interface ComplaintHandleResult {
  id: number
  status: ComplaintStatus
}

// ---------------------------------------------------------------- 日志 / 设置

export interface OperationLogVO {
  id: number
  operatorType: string | null
  operatorName: string | null
  module: string | null
  action: string | null
  targetId: string | null
  detail: string | null
  ip: string | null
  createdAt: string | null
}

export interface SystemSetting {
  id: number
  settingKey: string
  settingValue: string | null
  description: string | null
  createdAt: string | null
  updatedAt: string | null
}
