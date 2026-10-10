import { httpPost } from '@/utils/request'
import type { LoginRequest, LoginResponse } from '@/types/admin'

/** POST /api/auth/admin/login */
export function adminLogin(payload: LoginRequest): Promise<LoginResponse> {
  return httpPost<LoginResponse>('/api/auth/admin/login', payload)
}
