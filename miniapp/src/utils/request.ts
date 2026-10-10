import Taro from '@tarojs/taro'
import { AUTH_EXPIRED_CODES, BizCode, type ApiResult } from '@/types/api'

/**
 * 统一请求层。
 *
 * 职责：
 * 1. 自动拼接 baseURL、自动带 Authorization: Bearer <token>
 * 2. 拆信封：HTTP 200 + code=0 才算成功，业务错误统一抛 BizError
 * 3. 登录态失效（401 / 40100 / 40101）→ 清理 token → 跳登录页
 * 4. 网络异常 → 抛 NetError，页面可提示「网络异常」而不是白屏
 *
 * 页面通过 try/catch + PageState 组件统一处理「加载中 / 空数据 / 请求失败 / 提交成功 / 网络异常」。
 */

const TOKEN_STORAGE_KEY = 'nsm_token'

/**
 * 后端地址。
 * 默认指向本机开发后端，可用 TARO_APP_API_BASE 覆盖（Taro 会在构建时内联 process.env.TARO_APP_*）。
 * 注意：微信开发者工具需勾选「不校验合法域名」，或在小程序后台配置 request 合法域名。
 */
export const BASE_URL: string =
  (process.env.TARO_APP_API_BASE as string | undefined) || 'http://localhost:8080'

/** 业务错误：后端明确返回了非 0 code */
export class BizError extends Error {
  readonly code: number
  constructor(code: number, message: string) {
    super(message)
    this.name = 'BizError'
    this.code = code
  }
}

/** 网络/超时/无响应 */
export class NetError extends Error {
  constructor(message = '网络异常，请检查网络后重试') {
    super(message)
    this.name = 'NetError'
  }
}

let redirectingToLogin = false

// ---------------------------------------------------------------- token 存取

export function getToken(): string {
  try {
    return Taro.getStorageSync(TOKEN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(token: string): void {
  try {
    Taro.setStorageSync(TOKEN_STORAGE_KEY, token)
  } catch {
    /* 存储失败不阻断业务流程 */
  }
}

export function clearToken(): void {
  try {
    Taro.removeStorageSync(TOKEN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** 登录失效：清 token 并跳登录页（带去重，避免并发请求重复跳转） */
function handleAuthExpired(): void {
  clearToken()
  if (redirectingToLogin) return
  redirectingToLogin = true
  Taro.showToast({ title: '登录已失效，请重新登录', icon: 'none', duration: 1500 })
  setTimeout(() => {
    redirectingToLogin = false
    Taro.navigateTo({ url: '/pages/auth/login/index' })
  }, 1200)
}

// ---------------------------------------------------------------- 请求主体

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface RequestOptions {
  url: string
  method?: HttpMethod
  data?: Record<string, unknown>
  /** 是否需要登录态，默认 true */
  auth?: boolean
  /** 业务错误是否自动 toast，默认 true；页面想自行提示时置 false */
  silent?: boolean
}

/**
 * 发起请求并返回 data。
 * 失败一律抛 BizError 或 NetError。
 */
export async function request<T>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, auth = true, silent = false } = options

  const header: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) header.Authorization = `Bearer ${token}`
  }

  let res: Taro.request.SuccessCallbackResult<ApiResult<T>>
  try {
    res = await Taro.request({
      url: BASE_URL + url,
      method,
      data,
      header,
      timeout: 15000
    })
  } catch (e) {
    // Taro.request 在网络层失败时 reject
    throw new NetError(describeNetworkError(e))
  }

  const body = res.data as ApiResult<T> | undefined

  // HTTP 层错误：401 登录失效 / 403 越权
  if (res.statusCode === 401) {
    handleAuthExpired()
    throw new BizError(BizCode.UNAUTHORIZED, '登录已失效，请重新登录')
  }
  if (res.statusCode === 403) {
    const msg = body?.message || '无权访问该数据'
    if (!silent) Taro.showToast({ title: msg, icon: 'none' })
    throw new BizError(body?.code ?? BizCode.FORBIDDEN, msg)
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    const msg = body?.message || `服务异常（${res.statusCode}）`
    if (!silent) Taro.showToast({ title: msg, icon: 'none' })
    throw new BizError(body?.code ?? -1, msg)
  }

  if (!body || typeof body.code !== 'number') {
    throw new NetError('响应格式异常，请稍后重试')
  }

  // 业务失败
  if (body.code !== 0) {
    if (AUTH_EXPIRED_CODES.includes(body.code)) {
      handleAuthExpired()
      throw new BizError(body.code, body.message || '登录已失效')
    }
    if (!silent) Taro.showToast({ title: body.message || '操作失败', icon: 'none' })
    throw new BizError(body.code, body.message || '操作失败')
  }

  return body.data
}

function describeNetworkError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? '')
  if (/timeout/i.test(raw)) return '请求超时，请稍后重试'
  if (/fail|network|error/i.test(raw)) return '网络异常，请检查网络后重试'
  return '网络异常，请检查网络后重试'
}

/** 拼接查询串，跳过 undefined / null / '' */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = []
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null || v === '') return
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  })
  return parts.length ? `?${parts.join('&')}` : ''
}