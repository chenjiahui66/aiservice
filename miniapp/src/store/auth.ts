import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { clearToken, getToken, setToken } from '@/utils/request'
import type { AuditStatus } from '@/types/domain'

interface AuthState {
  token: string
  providerId: number | null
  displayName: string
  username: string
  auditStatus: AuditStatus | null
  auditRemark: string | null
  /** 是否已尝试过从本地存储恢复登录态 */
  hydrated: boolean

  hydrate: () => void
  signIn: (payload: {
    token: string
    providerId: number
    displayName: string | null
    username: string
    auditStatus: AuditStatus | null
    auditRemark: string | null
  }) => void
  setAuditStatus: (status: AuditStatus | null, remark: string | null) => void
  signOut: () => void
}

const PROFILE_KEY = 'nsm_profile'

interface StoredProfile {
  providerId: number
  displayName: string
  username: string
  auditStatus: AuditStatus | null
  auditRemark: string | null
}

function readProfile(): StoredProfile | null {
  try {
    const raw = Taro.getStorageSync(PROFILE_KEY)
    return raw ? (raw as StoredProfile) : null
  } catch {
    return null
  }
}

/**
 * 登录态。
 * token 单独存（请求层要读），展示用的资料一起存，刷新页面后无需重新登录。
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: '',
  providerId: null,
  displayName: '',
  username: '',
  auditStatus: null,
  auditRemark: null,
  hydrated: false,

  hydrate: () => {
    const token = getToken()
    const profile = readProfile()
    if (!token || !profile) {
      set({ token: '', providerId: null, hydrated: true })
      return
    }
    set({
      token,
      providerId: profile.providerId,
      displayName: profile.displayName || '',
      username: profile.username || '',
      auditStatus: profile.auditStatus,
      auditRemark: profile.auditRemark,
      hydrated: true
    })
  },

  signIn: ({ token, providerId, displayName, username, auditStatus, auditRemark }) => {
    setToken(token)
    const profile: StoredProfile = {
      providerId,
      displayName: displayName || '',
      username: username || '',
      auditStatus: auditStatus ?? null,
      auditRemark: auditRemark ?? null
    }
    try {
      Taro.setStorageSync(PROFILE_KEY, profile)
    } catch {
      /* ignore */
    }
    set({
      token,
      providerId,
      displayName: profile.displayName,
      username: profile.username,
      auditStatus: profile.auditStatus,
      auditRemark: profile.auditRemark,
      hydrated: true
    })
  },

  setAuditStatus: (auditStatus, auditRemark) => {
    const profile = readProfile()
    if (profile) {
      try {
        Taro.setStorageSync(PROFILE_KEY, { ...profile, auditStatus, auditRemark })
      } catch {
        /* ignore */
      }
    }
    set({ auditStatus, auditRemark })
  },

  signOut: () => {
    clearToken()
    try {
      Taro.removeStorageSync(PROFILE_KEY)
    } catch {
      /* ignore */
    }
    set({
      token: '',
      providerId: null,
      displayName: '',
      username: '',
      auditStatus: null,
      auditRemark: null,
      hydrated: true
    })
  }
}))

/** 是否有登录态 */
export function isLoggedIn(): boolean {
  return !!getToken()
}