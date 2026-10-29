import { buildQuery, request } from '@/utils/request'
import type { PageResult } from '@/types/api'
import type {
  BoardVO,
  CustomerDetailVO,
  CustomerVO,
  ManualOrderRequest,
  MyServiceItem,
  OrderVO,
  ProviderPageConfig,
  QrGenerateResult,
  ReferralInfoVO,
  ReferralStats
} from '@/types/domain'

// ---------------------------------------------------------------- 主页配置

export function fetchMyPage() {
  return request<ProviderPageConfig>({ url: '/api/provider/page', silent: true })
}

export function updateMyPage(data: Partial<ProviderPageConfig> & Record<string, unknown>) {
  return request<ProviderPageConfig>({
    url: '/api/provider/page',
    method: 'PUT',
    data,
    silent: true
  })
}

// ---------------------------------------------------------------- 我的服务类目

/**
 * 我能提供的服务类目 = 平台后台维护的那批 + 我勾选了哪几项。
 * 服务者不能自建类目，只能在这批里挑。
 */
export function fetchMyServiceItems() {
  return request<MyServiceItem[]>({
    url: '/api/provider/service-items/manage',
    silent: true
  })
}

/** 开始提供某个类目 */
export function selectServiceItem(templateId: number) {
  return request<void>({
    url: `/api/provider/service-items/manage/${templateId}`,
    method: 'PUT',
    data: {},
    silent: true
  })
}

/** 不再提供某个类目（之后可以随时加回来） */
export function unselectServiceItem(templateId: number) {
  return request<void>({
    url: `/api/provider/service-items/manage/${templateId}`,
    method: 'DELETE',
    data: {},
    silent: true
  })
}

// ---------------------------------------------------------------- 推广中心

export function fetchReferral() {
  return request<ReferralInfoVO>({ url: '/api/provider/referral', silent: true })
}

export function fetchReferralStats() {
  return request<ReferralStats>({ url: '/api/provider/referral/stats', silent: true })
}

/** 生成 / 重新生成小程序码 */
export function regenerateQr() {
  return request<QrGenerateResult>({
    url: '/api/provider/referral/qr',
    method: 'POST',
    data: {},
    silent: true
  })
}

// ---------------------------------------------------------------- 今日台账

/** 省略 date 即今天；支持未来日期 */
export function fetchBoard(date?: string) {
  const qs = buildQuery({ date })
  return request<BoardVO>({ url: `/api/provider/board${qs}`, silent: true })
}

// ---------------------------------------------------------------- 订单

export interface OrderQuery {
  dateFrom?: string
  dateTo?: string
  status?: string
  keyword?: string
  serviceItemId?: number
  page?: number
  size?: number
}

export function fetchOrders(query: OrderQuery) {
  return request<PageResult<OrderVO>>({
    url: `/api/provider/orders${buildQuery({ ...query })}`,
    silent: true
  })
}

export function fetchOrderDetail(id: number) {
  return request<OrderVO>({ url: `/api/provider/orders/${id}`, silent: true })
}

/** 手动记单 */
export function createManualOrder(data: ManualOrderRequest) {
  return request<OrderVO>({
    url: '/api/provider/orders',
    method: 'POST',
    data: data as unknown as Record<string, unknown>,
    silent: true
  })
}

export function confirmOrder(id: number) {
  return request<OrderVO>({ url: `/api/provider/orders/${id}/confirm`, method: 'POST', data: {}, silent: true })
}

export function startOrder(id: number) {
  return request<OrderVO>({ url: `/api/provider/orders/${id}/start`, method: 'POST', data: {}, silent: true })
}

export function completeOrder(id: number, remark?: string) {
  return request<OrderVO>({
    url: `/api/provider/orders/${id}/complete`,
    method: 'POST',
    data: { remark },
    silent: true
  })
}

export function cancelOrder(id: number, reason: string) {
  return request<OrderVO>({
    url: `/api/provider/orders/${id}/cancel`,
    method: 'POST',
    data: { reason },
    silent: true
  })
}

export function updateOrderNote(id: number, providerNote: string) {
  return request<OrderVO>({
    url: `/api/provider/orders/${id}/note`,
    method: 'PUT',
    data: { providerNote },
    silent: true
  })
}

// ---------------------------------------------------------------- 客户

export function fetchCustomers(keyword?: string, page = 1, size = 20) {
  return request<PageResult<CustomerVO>>({
    url: `/api/provider/customers${buildQuery({ keyword, page, size })}`,
    silent: true
  })
}

export function fetchCustomerDetail(id: number) {
  return request<CustomerDetailVO>({ url: `/api/provider/customers/${id}`, silent: true })
}

export function updateCustomer(
  id: number,
  data: {
    name?: string
    phone?: string
    community?: string
    address?: string
    /**
     * ISO 日期时间，如 `2026-10-25T00:00:00`。
     * ⚠️ 必须带时间部分：后端字段是 LocalDateTime，
     *    直接发 Picker 给的纯日期 `2026-10-25` 会反序列化失败报「请求体格式不正确」。
     *    用 `utils/date` 的 `toDateTimeStr()` 生成，别手拼。
     */
    nextServiceAt?: string | null
  }
) {
  return request<CustomerDetailVO>({
    url: `/api/provider/customers/${id}`,
    method: 'PUT',
    data: data as unknown as Record<string, unknown>,
    silent: true
  })
}