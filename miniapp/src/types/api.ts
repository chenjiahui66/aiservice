/**
 * 接口通用响应信封。
 * 后端约定：业务失败统一 HTTP 200 + 非 0 code；仅未认证 401、跨分区越权 403 使用非 200。
 */
export interface ApiResult<T> {
  code: number
  message: string
  data: T
  success?: boolean
}

/** 分页结构 */
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}

/** 业务错误码（取自 docs/API.md） */
export const BizCode = {
  PARAM_INVALID: 40000,
  UNAUTHORIZED: 40100,
  TOKEN_INVALID: 40101,
  BAD_CREDENTIALS: 40102,
  ACCOUNT_DISABLED: 40103,
  FORBIDDEN: 40300,
  REFERRAL_NOT_FOUND: 41001,
  REFERRAL_DISABLED: 41002,
  PROVIDER_NOT_AUDITED: 41005,
  PROVIDER_REJECTED: 41006,
  PROVIDER_DISABLED: 41007,
  PAGE_CLOSED: 41008,
  ORDER_NOT_FOUND: 42001,
  ORDER_STATUS_INVALID: 42002,
  ORDER_TRANSITION_ILLEGAL: 42003,
  SLOT_UNAVAILABLE: 42004,
  BEYOND_BOOKING_RANGE: 42005,
  CUSTOMER_NOT_FOUND: 43001,
  SERVICE_ITEM_NOT_FOUND: 44001,
  SERVICE_ITEM_DISABLED: 44002,
  WECHAT_CODE_FAILED: 45002
} as const

/** 登录态失效类错误码：需要清理本地 token 并跳登录页 */
export const AUTH_EXPIRED_CODES: number[] = [
  BizCode.UNAUTHORIZED,
  BizCode.TOKEN_INVALID
]