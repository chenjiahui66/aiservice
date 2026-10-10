import { httpGet, httpPost, httpPut } from '@/utils/request'
import type { QueryParams } from '@/types/common'
import type {
  AuditRequest,
  ComplaintHandleResult,
  ComplaintRecord,
  DashboardVO,
  OperationLogVO,
  OrderQuery,
  OrderVO,
  ProviderListVO,
  ProviderQuery,
  ServiceItemSaveRequest,
  ServiceItemVO,
  StatusRequest,
  SystemSetting
} from '@/types/admin'
import type { PageResult } from '@/types/common'

// ---------------------------------------------------------------- 概览

/** GET /api/admin/dashboard */
export function fetchDashboard(): Promise<DashboardVO> {
  return httpGet<DashboardVO>('/api/admin/dashboard')
}

// ---------------------------------------------------------------- 服务者

/** GET /api/admin/providers */
export function fetchProviders(
  query: ProviderQuery
): Promise<PageResult<ProviderListVO>> {
  return httpGet<PageResult<ProviderListVO>>('/api/admin/providers', {
    keyword: query.keyword,
    auditStatus: query.auditStatus,
    enabled: query.enabled,
    page: query.page,
    size: query.size
  })
}

/** GET /api/admin/providers/{id} */
export function fetchProviderDetail(id: number): Promise<ProviderListVO> {
  return httpGet<ProviderListVO>(`/api/admin/providers/${id}`)
}

/** POST /api/admin/providers/{id}/audit */
export function auditProvider(
  id: number,
  payload: AuditRequest
): Promise<ProviderListVO> {
  return httpPost<ProviderListVO>(`/api/admin/providers/${id}/audit`, payload)
}

/** POST /api/admin/providers/{id}/status */
export function setProviderStatus(
  id: number,
  payload: StatusRequest
): Promise<ProviderListVO> {
  return httpPost<ProviderListVO>(`/api/admin/providers/${id}/status`, payload)
}

// ---------------------------------------------------------------- 服务项目 / 主页模板

/** GET /api/admin/service-items */
export function fetchServiceItems(): Promise<ServiceItemVO[]> {
  return httpGet<ServiceItemVO[]>('/api/admin/service-items')
}

/** POST /api/admin/service-items */
export function createServiceItem(
  payload: ServiceItemSaveRequest
): Promise<ServiceItemVO> {
  return httpPost<ServiceItemVO>('/api/admin/service-items', payload)
}

/** PUT /api/admin/service-items/{id} */
export function updateServiceItem(
  id: number,
  payload: ServiceItemSaveRequest
): Promise<ServiceItemVO> {
  return httpPut<ServiceItemVO>(`/api/admin/service-items/${id}`, payload)
}

// ---------------------------------------------------------------- 订单（只读）

/** GET /api/admin/orders —— 只读，管理员不修改服务者业务记录。 */
export function fetchAdminOrders(
  query: OrderQuery
): Promise<PageResult<OrderVO>> {
  return httpGet<PageResult<OrderVO>>('/api/admin/orders', {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    status: query.status,
    keyword: query.keyword,
    page: query.page,
    size: query.size
  })
}

// ---------------------------------------------------------------- 投诉

/** GET /api/admin/complaints */
export function fetchComplaints(params: {
  status?: string
  page?: number
  size?: number
}): Promise<PageResult<ComplaintRecord>> {
  return httpGet<PageResult<ComplaintRecord>>('/api/admin/complaints', params)
}

/** POST /api/admin/complaints/{id}/handle —— status / remark 走 query。 */
export function handleComplaint(
  id: number,
  status: string,
  remark: string
): Promise<ComplaintHandleResult> {
  return httpPost<ComplaintHandleResult>(
    `/api/admin/complaints/${id}/handle`,
    undefined,
    { status, remark }
  )
}

// ---------------------------------------------------------------- 日志 / 设置

/** GET /api/admin/logs */
export function fetchLogs(params: {
  page?: number
  size?: number
}): Promise<PageResult<OperationLogVO>> {
  return httpGet<PageResult<OperationLogVO>>('/api/admin/logs', params)
}

/** GET /api/admin/settings */
export function fetchSettings(): Promise<SystemSetting[]> {
  return httpGet<SystemSetting[]>('/api/admin/settings')
}

/** PUT /api/admin/settings/{key}?value=xxx */
export function updateSetting(
  key: string,
  value: string
): Promise<SystemSetting> {
  return httpPut<SystemSetting>(`/api/admin/settings/${encodeURIComponent(key)}`, undefined, {
    value
  })
}

export type { QueryParams }
