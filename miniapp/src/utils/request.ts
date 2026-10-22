import Taro from '@tarojs/taro'
import { AUTH_EXPIRED_CODES, BizCode, type ApiResult } from '@/types/api'
import { redirectToLogin } from '@/utils/auth-redirect'
import { clearToken, getToken, setToken } from '@/utils/token'

/**
 * 统一请求层。
 *
 * 职责：
 * 1. 自动拼接 baseURL、自动带 Authorization: Bearer <token>
 * 2. 拆信封：HTTP 200 + code=0 才算成功，业务错误统一抛 BizError
 * 3. 登录态失效（带了 token 却被拒）→ 清理 token → 跳登录页
 * 4. 网络异常 → 抛 NetError，页面可提示「网络异常」而不是白屏
 *
 * 页面通过 try/catch + PageState 组件统一处理「加载中 / 空数据 / 请求失败 / 提交成功 / 网络异常」。
 */

export { getToken, setToken, clearToken } from '@/utils/token'

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

/**
 * 登录失效：清 token 并跳登录页。
 *
 * 只在「本次请求带了 token 却被拒绝」时调用 —— 也就是**真的**登录态过期。
 * 「本来就没登录」不归这里管，否则会和 useAuthGuard 各跳一次 → 连跳两个登录页。
 */
function handleAuthExpired(): void {
  clearToken()
  redirectToLogin({ toast: '登录已失效，请重新登录' })
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
  const token = auth ? getToken() : ''
  if (token) header.Authorization = `Bearer ${token}`

  // 需要登录的接口，但本地根本没有 token —— 别发请求了。
  // 发出去只会拿到一个 401，然后被误当成「登录失效」，
  // 既浪费一次往返，又可能和 useAuthGuard 各跳一次登录页。
  // 「未登录」由 useAuthGuard 处理，「登录过期」才由这里处理。
  if (auth && !token) {
    throw new BizError(BizCode.UNAUTHORIZED, '请先登录')
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
    // 只有「带了 token 却被拒」才算登录失效
    if (token) handleAuthExpired()
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
      // 同上：带了 token 才是「过期」，没带就是「没登录」
      if (token) handleAuthExpired()
      throw new BizError(body.code, body.message || '登录已失效')
    }
    if (!silent) Taro.showToast({ title: body.message || '操作失败', icon: 'none' })
    throw new BizError(body.code, body.message || '操作失败')
  }

  return body.data
}

/**
 * 把底层失败翻译成**可操作**的提示。
 *
 * 小程序最常见的坑是「合法域名未配置」——请求在微信层就被拦下，
 * 根本发不出去，Network 面板里什么也看不到，只有 Console 一行
 * `request:fail url not in domain list`。
 * 如果统一报「网络异常」，开发者根本猜不到真正原因。
 */
function describeNetworkError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? '')

  // 域名未配置 / 未勾选「不校验合法域名」
  if (/url not in domain list|not in domain list/i.test(raw)) {
    return '接口域名未授权：请在微信开发者工具「详情 → 本地设置」勾选「不校验合法域名」'
  }
  // 真机预览 / 体验版必须走 https 且在后台配置 request 合法域名
  if (/https|ssl|tls|certificate/i.test(raw)) {
    return '接口必须使用 HTTPS，并在小程序后台配置 request 合法域名'
  }
  // 开发工具里 localhost 常被拦；真机根本访问不到本机
  if (/localhost|127\.0\.0\.1/.test(BASE_URL) && /fail|network|error/i.test(raw)) {
    return '当前后端地址是 localhost，真机无法访问；请设置 TARO_APP_API_BASE 为可访问的域名'
  }
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