import Taro from '@tarojs/taro'
import { fetchReferral } from '@/api/provider'

/**
 * 自己的推广码缓存。
 *
 * 分享功能需要「当前服务者的推广码」——分享出去的链接带上它，
 * 朋友点进来就落到我的主页、订单直接进我的台账。这是本项目分享的**唯一价值所在**，
 * 分享一个不带推广码的链接等于白分享。
 *
 * 但推广码要调接口才能拿到，而微信的分享回调是同步的（朋友圈分享更是只能同步返回），
 * 所以必须：
 *   1. 平时拿到就缓存（进「我的推广」页时一定会拿到）；
 *   2. 分享时先用缓存兜底，再用 promise 在 3 秒窗口内补齐真实值。
 */
const STORAGE_KEY = 'nsm_referral_code'

/** 读缓存的推广码（同步，不发请求）。没有则返回空串。 */
export function getCachedReferralCode(): string {
  try {
    const v = Taro.getStorageSync(STORAGE_KEY)
    return typeof v === 'string' ? v : ''
  } catch {
    return ''
  }
}

/** 缓存推广码。 */
export function cacheReferralCode(code: string | null | undefined): void {
  if (!code) return
  try {
    Taro.setStorageSync(STORAGE_KEY, code)
  } catch {
    /* 存不进去不影响主流程 */
  }
}

/** 清掉缓存（退出登录时用，避免把上一个账号的推广码带出去）。 */
export function clearCachedReferralCode(): void {
  try {
    Taro.removeStorageSync(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** 同一个时刻只发一个请求，避免用户连点分享时打出一串重复请求。 */
let pending: Promise<string> | null = null

/**
 * 拿到自己的推广码：缓存优先，没有就请求一次。
 *
 * <p>失败一律返回空串 —— 分享降级成「不带推广码」，绝不能因为分享失败而报错。</p>
 */
export function ensureReferralCode(): Promise<string> {
  const cached = getCachedReferralCode()
  if (cached) return Promise.resolve(cached)
  if (pending) return pending

  pending = fetchReferral()
    .then((info) => {
      cacheReferralCode(info.referralCode)
      return info.referralCode || ''
    })
    .catch(() => '')
    .then((code) => {
      pending = null
      return code
    })
  return pending
}
