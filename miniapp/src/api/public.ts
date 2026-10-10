import { request } from '@/utils/request'
import type {
  BookingRequest,
  BookingResult,
  ProviderHomeVO,
  ServiceItem
} from '@/types/domain'

/**
 * 公开接口（客户扫码路径，无需登录态）。
 * 客户不需要、也不应该进入服务者工作台。
 */

/** 按推广码查询服务主页 */
export function fetchProviderHome(referralCode: string) {
  return request<ProviderHomeVO>({
    url: `/api/public/provider/home?referralCode=${encodeURIComponent(referralCode)}`,
    auth: false,
    silent: true
  })
}

/**
 * 提交预约。
 * ⚠️ 请求体中 **没有 providerId**：订单归属由后端依据 referralCode 反查裁决。
 */
export function submitBooking(data: BookingRequest) {
  return request<BookingResult>({
    url: '/api/public/bookings',
    method: 'POST',
    data: data as unknown as Record<string, unknown>,
    auth: false,
    silent: true
  })
}

/** 服务者自己可提供的服务项目模板 */
export function fetchServiceItems() {
  return request<ServiceItem[]>({
    url: '/api/provider/service-items',
    silent: true
  })
}