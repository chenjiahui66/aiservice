/** 领域模型：字段与后端真实响应一一对应（已用真实接口校验） */

/** 审核状态 */
export type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** 后端 enabled 字段是字符串枚举，不是布尔 */
export type EnabledFlag = 'ENABLED' | 'DISABLED'

/** 订单状态机 */
export type OrderStatus =
  | 'PENDING_CONFIRM'
  | 'CONFIRMED'
  | 'SERVING'
  | 'COMPLETED'
  | 'CANCELLED'

/** 小程序码模式：DEV = 开发降级码，不是真实微信小程序码 */
export type QrMode = 'REAL' | 'DEV'

// ---------------------------------------------------------------- 意见反馈

/**
 * 反馈类型，取值必须与后端 ComplaintType 枚举一致，
 * 否则管理后台 ComplaintView 无法正确归类。
 */
export type ComplaintType = 'COMPLAINT' | 'FEEDBACK' | 'VIOLATION'

export type ComplaintStatus = 'PENDING' | 'PROCESSING' | 'CLOSED'

/**
 * 意见反馈提交请求。
 *
 * ⚠️ 不含 providerId：服务者身份由后端在检测到登录态时自行取，
 * 客户身份则通过 referralCode 反查，前端不指定归属。
 */
export interface FeedbackRequest {
  type: ComplaintType
  content: string
  customerName?: string
  customerPhone?: string
  /** 客户扫码入口进入时携带，用于反查服务者 */
  referralCode?: string
  /** 是否已阅读并同意《隐私政策》（后端强制校验） */
  privacyAccepted: boolean
  /** 同意的隐私政策版本号，用于后端留证 */
  policyVersion: string
}

export interface FeedbackResult {
  id: number
  status: ComplaintStatus
  statusLabel: string
  createdAt: string
}

/** 表单字段类型，由后端 formFields 配置决定，前端只负责渲染 */
export type FormFieldType =
  | 'text'
  | 'phone'
  | 'textarea'
  | 'number'
  | 'date'
  | 'slot'
  | 'serviceItem'
  | 'select'

export interface FormFieldOption {
  label: string
  value: string | number
}

/** 单个表单项的配置（来自 formFields JSON 数组的元素） */
export interface FormFieldConfig {
  key: string
  type: FormFieldType
  label: string
  required?: boolean
  maxLength?: number
  placeholder?: string
  min?: number
  max?: number
  options?: FormFieldOption[]
}

/** 预约规则（来自 bookingRules JSON 对象） */
export interface BookingRules {
  slots?: string[]
  closedDays?: number[]
  advanceDays?: number
  minAdvanceHours?: number
}

// ---------------------------------------------------------------- 认证

export interface AuthResult {
  token: string
  tokenType: string
  providerId: number
  displayName: string | null
  username: string
  auditStatus: AuditStatus | null
  auditRemark: string | null
  expiresInSeconds: number
}

export interface RegisterRequest {
  phone: string
  password: string
  realName: string
  serviceArea: string
  /**
   * 是否已阅读并同意《用户服务协议》和《隐私政策》。
   * 后端强制校验：false / 不传都会被拒。
   */
  consentAgreed: boolean
  /** 同意的协议版本号，用于后端留证 */
  policyVersion: string
}

export interface LoginRequest {
  username: string
  password: string
  /** 是否已阅读并同意《用户服务协议》和《隐私政策》 */
  consentAgreed: boolean
  /** 同意的协议版本号，用于后端留证 */
  policyVersion: string
}

// ---------------------------------------------------------------- 公开（客户扫码）

export interface ServiceItem {
  id: number
  name: string
  description: string | null
  iconUrl: string | null
  unitDesc: string | null
  priceDesc: string | null
  /** JSON 字符串，需 parse 后动态渲染 */
  formFields: string
  /** JSON 字符串，需 parse 后约束日期与时段 */
  bookingRules: string
  notes?: string | null
}

/**
 * 「我的服务类目」一行。
 *
 * 类目全部由平台后台维护，服务者只负责勾选自己提供哪几项，
 * 所以这里只有模板信息 + 勾选状态，没有「新建类目」这回事。
 */
export interface MyServiceItem {
  /** 平台模板 id —— 勾选 / 取消都用它 */
  templateId: number
  /** 我自己派生出的那条记录 id；从未勾选过为 null */
  myItemId: number | null
  name: string
  description: string | null
  iconUrl: string | null
  unitDesc: string | null
  priceDesc: string | null
  notes: string | null
  sortOrder: number | null
  /** 平台是否仍在启用这个类目；停用后不能再勾选 */
  platformEnabled: boolean
  /** 我当前是否在提供这一项 */
  selected: boolean
}

export interface ProviderHomeVO {
  referralCode: string
  providerId: number
  displayName: string
  avatarUrl: string | null
  intro: string | null
  serviceArea: string | null
  availableTime: string | null
  priceDesc: string | null
  serviceRules: string | null
  contactVisible: boolean
  /** contactVisible=false 时后端不下发号码，这里为 null */
  contactPhone: string | null
  serviceItems: ServiceItem[]
  disclaimer: string | null
}

/** 预约提交请求 —— 注意：没有 providerId，订单归属由后端按推广码反查 */
export interface BookingRequest {
  referralCode: string
  serviceItemId: number
  customerName: string
  customerPhone: string
  community?: string
  address: string
  bookingDate: string
  bookingSlot: string
  quantity?: number
  serviceDesc?: string
  remark?: string
  privacyAccepted: boolean
  /** 同意的隐私政策版本号，用于后端留证 */
  policyVersion: string
  channel: string
}

export interface BookingResult {
  orderNo: string
  status: OrderStatus
  statusLabel: string
  providerDisplayName: string | null
  message: string
}

// ---------------------------------------------------------------- 服务者端

export interface ProviderProfile {
  providerId: number
  userId: number
  realName: string
  serviceArea: string | null
  auditStatus: AuditStatus
  auditStatusLabel: string
  enabled: EnabledFlag
  nickname: string | null
  phone: string
}

export interface ProviderPageConfig {
  providerId?: number
  displayName: string | null
  intro: string | null
  serviceArea: string | null
  availableTime: string | null
  priceDesc: string | null
  serviceRules: string | null
  contactVisible: boolean
  contactPhone: string | null
  enabled: boolean
}

export interface OrderLog {
  action: string
  actionLabel: string
  fromStatus: OrderStatus | null
  toStatus: OrderStatus | null
  remark: string | null
  operatorType: string | null
  operatorName: string | null
  createdAt: string
}

export interface OrderVO {
  id: number
  orderNo: string
  customerId: number
  customerName: string
  customerPhone: string
  community: string | null
  address: string
  serviceName: string
  quantity: number
  serviceDesc: string | null
  customerRemark: string | null
  providerNote: string | null
  bookingDate: string
  bookingSlot: string
  status: OrderStatus
  statusLabel: string
  source: string
  channel: string | null
  cancelReason: string | null
  confirmedAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  logs?: OrderLog[]
}

/** 手动记单请求 */
export interface ManualOrderRequest {
  customerName: string
  customerPhone: string
  community?: string
  address: string
  serviceItemId: number
  bookingDate: string
  bookingSlot: string
  quantity?: number
  serviceDesc?: string
  confirmed: boolean
}

export interface BoardVO {
  date: string
  pendingConfirmCount: number
  pendingServiceCount: number
  completedCount: number
  cancelledCount: number
  totalCount: number
  tasks: OrderVO[]
}

export interface CustomerVO {
  id: number
  name: string
  phone: string
  community: string | null
  address: string | null
  firstServiceAt: string | null
  lastServiceAt: string | null
  nextServiceAt?: string | null
  orderCount: number
  createdAt: string
}

export interface CustomerDetailVO {
  customer: CustomerVO
  orders: OrderVO[]
}

export interface ReferralInfoVO {
  referralCodeId: number
  referralCode: string
  status: string
  qrImageKey?: string | null
  qrImageUrl?: string | null
  qrMode: QrMode
  qrModeLabel: string
  /** DEV 模式下必须展示的警示文案 */
  qrNotice?: string | null
  qrScenePage?: string | null
  channel?: string | null
  visitCount: number
  bookingCount: number
  shareText: string
  /**
   * 推广指导视频的 https 直链，由管理员在「系统基础设置」里配置。
   * 为空表示还没配置，此时不显示「视频推广指导」入口。
   */
  promoVideoUrl?: string | null
  createdAt?: string | null
}

export interface QrGenerateResult {
  imageKey: string
  mode: QrMode
  notice: string | null
  imageUrl: string
}

export interface ReferralStats {
  todayBookingCount: number
  weekBookingCount: number
  totalBookingCount: number
  completedCount: number
  pendingCount: number
  totalCustomers: number
  /**
   * 完成率，单位是**百分比（0~100）**，不是 0~1 的比率。
   * 100 表示 100%。见 ReferralCodeService.buildStats。
   */
  completionRate: number
}