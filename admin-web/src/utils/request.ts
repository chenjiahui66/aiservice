import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResult, QueryParams } from '@/types/common'

const TOKEN_KEY = 'admin_token'

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token)
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY)
  }
}

/** 业务错误：HTTP 200 但 code != 0。 */
export class BizError extends Error {
  readonly code: number
  constructor(code: number, message: string) {
    super(message)
    this.name = 'BizError'
    this.code = code
  }
}

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 15000
})

service.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

service.interceptors.response.use(
  (response) => {
    // 后端统一返回 HTTP 200 + 业务 code；此处拆包，业务失败直接抛。
    const body = response.data as ApiResult<unknown> | undefined
    if (body && typeof body.code === 'number' && body.code !== 0) {
      const message = body.message || '请求失败'
      ElMessage.error(message)
      return Promise.reject(new BizError(body.code, message))
    }
    return response
  },
  (error: AxiosError) => {
    const status = error.response?.status
    const payload = error.response?.data
    // 后端所有响应都带 Result 信封；空 body 的 500 是 dev 代理连不上上游（后端未启动）的特征。
    const upstreamDown = status === 500 && (payload === '' || payload === undefined)

    if (status === 401) {
      tokenStorage.clear()
      ElMessage.error('登录状态已失效，请重新登录')
      if (!window.location.pathname.startsWith('/login')) {
        const redirect = encodeURIComponent(
          window.location.pathname + window.location.search
        )
        window.location.replace(`/login?redirect=${redirect}`)
      }
    } else if (status === 403) {
      ElMessage.error('无权访问该资源')
    } else if (upstreamDown) {
      ElMessage.error('无法连接后端服务，请确认后端已启动（默认 localhost:8080）')
    } else if (status) {
      ElMessage.error(`请求失败（HTTP ${status}）`)
    } else {
      ElMessage.error('网络异常，请确认后端服务已启动')
    }
    return Promise.reject(error)
  }
)

function unwrap<T>(response: { data: ApiResult<T> }): T {
  return response.data.data
}

export async function httpGet<T>(
  url: string,
  params?: QueryParams,
  config?: AxiosRequestConfig
): Promise<T> {
  return unwrap(await service.get<ApiResult<T>>(url, { params, ...config }))
}

export async function httpPost<T>(
  url: string,
  body?: unknown,
  params?: QueryParams
): Promise<T> {
  return unwrap(await service.post<ApiResult<T>>(url, body, { params }))
}

export async function httpPut<T>(
  url: string,
  body?: unknown,
  params?: QueryParams
): Promise<T> {
  return unwrap(await service.put<ApiResult<T>>(url, body, { params }))
}

export default service
