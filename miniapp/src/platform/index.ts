/**
 * 微信 / 非微信能力适配层。
 *
 * 小程序码、扫码 scene、分享都属于微信专属能力，跨端（H5 等）不保证可用。
 * 这里统一做「能用什么用什么」的降级：
 *  - 微信环境：scene 参数（需 decodeURIComponent）
 *  - 非微信环境：URL query 上的 referralCode
 * 任何一步失败都不抛错，只回退到 URL 参数。
 */
import Taro from '@tarojs/taro'

/** 当前是否运行在微信小程序 */
export function isWeapp(): boolean {
  try {
    return Taro.getEnv() === Taro.ENV_TYPE.WEAPP
  } catch {
    return false
  }
}

/** 微信小程序码图片地址（后端以站内相对路径下发） */
export function absoluteUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const base =
    (process.env.TARO_APP_API_BASE as string | undefined) || 'http://localhost:8080'
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * 解析进入小程序时携带的推广码。
 *
 * 微信：Taro.getEnterOptionsSync().query.scene，值需 decodeURIComponent
 * 非微信：回退到当前页面路由参数 referralCode
 */
export function getLaunchReferralCode(): string | null {
  // 1) 微信小程序码 scene
  if (isWeapp()) {
    try {
      const enter = Taro.getEnterOptionsSync()
      const scene = enter?.query?.scene
      if (typeof scene === 'string' && scene) {
        return safeDecode(scene)
      }
    } catch {
      /* 非微信环境或不支持则继续回退 */
    }
  }

  // 2) 页面路由参数（H5 query / 微信手动传参）
  try {
    const instance = Taro.getCurrentInstance()
    const params = instance?.router?.params as Record<string, string | undefined> | undefined
    const code = params?.referralCode
    if (typeof code === 'string' && code) return safeDecode(code)
  } catch {
    /* ignore */
  }

  return null
}

/**
 * 当前页面 query 上的推广码（客户从主页跳到预约页时用）。
 * 注意：此处只认 referralCode，不解析 scene，避免把无关参数当推广码。
 */
export function getCurrentQuery(): Record<string, string | undefined> {
  try {
    const instance = Taro.getCurrentInstance()
    return (instance?.router?.params as Record<string, string | undefined>) || {}
  } catch {
    return {}
  }
}

export function getQueryParam(key: string): string | undefined {
  const q = getCurrentQuery()
  const v = q[key]
  return typeof v === 'string' && v ? v : undefined
}

/** 复制文本：非微信环境降级为提示，不抛错 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Taro.setClipboardData({ data: text })
    return true
  } catch {
    Taro.showToast({ title: '当前环境不支持复制', icon: 'none' })
    return false
  }
}

/** 拨打电话：仅在拿到号码且微信环境可用 */
export function makePhoneCall(phone: string | null | undefined): void {
  if (!phone) {
    Taro.showToast({ title: '服务者未公开联系方式', icon: 'none' })
    return
  }
  if (!isWeapp()) {
    Taro.showToast({ title: '当前环境不支持拨打电话', icon: 'none' })
    return
  }
  Taro.makePhoneCall({ phoneNumber: phone }).catch(() => {
    Taro.showToast({ title: '拨号失败', icon: 'none' })
  })
}

/** 预览图片：非微信环境不做无意义的跳转，明确告知能力受限 */
export function previewImage(url: string): void {
  if (!url) return
  if (isWeapp()) {
    Taro.previewImage({ urls: [url], current: url }).catch(() => {})
    return
  }
  Taro.showToast({ title: '请在微信中打开以预览图片', icon: 'none' })
}

/**
 * 保存图片到手机相册。
 *
 * 小程序里「下载到本地」= 保存到相册（微信没有「下载到文件夹」这个能力）。
 * 需要「保存到相册」权限；用户拒绝过授权时要引导去设置页重新开启，
 * 否则用户只会看到一句没头没尾的「保存失败」。
 *
 * @param filePath 本地临时文件路径（downloadFile / canvas 导出的 tempFilePath）
 * @returns 是否保存成功
 */
export function saveImageToAlbum(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!filePath) {
      resolve(false)
      return
    }
    if (!isWeapp()) {
      Taro.showToast({ title: '当前环境不支持保存到相册', icon: 'none' })
      resolve(false)
      return
    }

    Taro.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        Taro.showToast({ title: '已保存到相册', icon: 'success' })
        resolve(true)
      },
      fail: (err) => {
        const errMsg = String((err as { errMsg?: string })?.errMsg || '')
        // 用户拒绝过「保存到相册」授权
        if (/auth deny|authorize|deny/i.test(errMsg)) {
          Taro.showModal({
            title: '需要相册权限',
            content: '保存图片需要你授权「保存到相册」，去设置里开启后回来再点一次保存。',
            confirmText: '去设置',
            cancelText: '知道了',
            success: (res) => {
              if (res.confirm) {
                Taro.openSetting({}).catch(() => {})
              } else {
                Taro.showToast({ title: '也可以长按图片直接保存', icon: 'none' })
              }
            }
          })
        } else {
          Taro.showToast({ title: '保存失败，可长按图片保存', icon: 'none' })
        }
        resolve(false)
      }
    })
  })
}