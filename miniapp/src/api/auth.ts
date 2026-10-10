import { request, buildQuery } from '@/utils/request'
import type {
  AuthResult,
  LoginRequest,
  ProviderProfile,
  RegisterRequest
} from '@/types/domain'

/** 服务者注册：注册后默认「待审核」 */
export function registerProvider(data: RegisterRequest) {
  return request<AuthResult>({
    url: '/api/auth/provider/register',
    method: 'POST',
    data: data as unknown as Record<string, unknown>,
    auth: false,
    silent: true
  })
}

/** 服务者登录 */
export function loginProvider(data: LoginRequest) {
  return request<AuthResult>({
    url: '/api/auth/provider/login',
    method: 'POST',
    data: data as unknown as Record<string, unknown>,
    auth: false,
    silent: true
  })
}

/** 我的资料（含审核状态） */
export function fetchProfile() {
  return request<ProviderProfile>({ url: '/api/provider/profile', silent: true })
}

/** 更新我的资料 */
export function updateProfile(data: Partial<ProviderProfile> & Record<string, unknown>) {
  return request<ProviderProfile>({
    url: '/api/provider/profile',
    method: 'PUT',
    data,
    silent: true
  })
}