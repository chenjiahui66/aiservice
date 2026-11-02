import { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useAuthStore } from '@/store/auth'
import { ensureReferralCode, getCachedReferralCode } from '@/utils/referral-code'

/**
 * 全局分享。
 *
 * <p>每个页面调一次 {@link usePageShare}，右上角菜单就同时有
 * 「发送给朋友」和「分享到朋友圈」。</p>
 *
 * <p><b>为什么两个分享的内容不一样</b> —— 这是微信的限制，不是偷懒：</p>
 * <ul>
 *   <li>{@code onShareAppMessage} 可以指定 <b>path</b>，能跳到任意页面。
 *       所以默认落到「我自己的服务主页」，并带上我的推广码：
 *       朋友点进来看到的是我的主页，订单直接进我的台账 —— 这是分享的全部意义。
 *       <br>拿不到推广码（访客身份）时**不指定 path**，退回分享当前页 ——
 *       否则客户点开只会看到「未识别到推广码」的报错页。</li>
 *   <li>{@code onShareTimeline} <b>只能分享当前页面</b>，只能追加 query，不能换 path。
 *       所以工作台页分享出去就是工作台页；客户主页页分享出去才是那个服务者的主页
 *       （真正能裂变的地方）。页面可以用 {@link PageShareOptions.timelineQuery} 定制。</li>
 * </ul>
 *
 * <p><b>一个必须知道的坑</b>：Taro 是在<b>编译期</b>扫页面源码，
 * 看到 {@code useShareAppMessage} / {@code onShareAppMessage} 才给该页面的
 * config 注入 {@code enableShareAppMessage}。本 hook 把调用包在了
 * {@code hooks/usePageShare.ts} 里，页面源码里根本不会出现这两个标识符 ——
 * <b>所以每个页面的 index.config.ts 必须显式写上
 * {@code enableShareAppMessage: true} 和 {@code enableShareTimeline: true}，
 * 否则微信菜单里根本不会出现分享项。</b></p>
 */

/** 拿不到服务者信息时的默认分享标题（用小程序名，最诚实）。 */
export const DEFAULT_SHARE_TITLE = '邻小来 · 邻里服务'

/** 服务者主页路径 */
const PROVIDER_HOME_PATH = '/pages/provider/index'

export interface PageShareOptions {
  /** 发送给朋友：标题。不传则用「<我的名字>的服务主页」。 */
  title?: string
  /**
   * 发送给朋友：落地路径。
   *
   * <p>不传 = 默认落到「我自己的服务主页」并自动带推广码。
   * 客户主页页必须显式传自己的推广码，否则会把「看主页的人」的推广码带出去，
   * 订单就记到别人头上了。</p>
   */
  path?: string
  /** 分享到朋友圈：标题。不传则用默认标题。 */
  timelineTitle?: string
  /**
   * 分享到朋友圈时追加的 query。
   *
   * <p>不传 = 默认带上自己缓存里的推广码（工作台页这样客户点进来能落到主页）；
   * 客户主页页要传自己的推广码，不能用分享者的。</p>
   */
  timelineQuery?: string
  /** 分享封面（本地路径或网络图片）。 */
  imageUrl?: string
}

/** 默认的朋友圈 query：带上自己缓存的推广码。 */
function defaultTimelineQuery(): string {
  const code = getCachedReferralCode()
  return code ? `referralCode=${encodeURIComponent(code)}` : ''
}

/**
 * 给页面开启「发送给朋友」+「分享到朋友圈」。
 *
 * <p>页面只需调用一次，不传参数即用默认策略。</p>
 */
export function usePageShare(options: PageShareOptions = {}) {
  const displayName = useAuthStore((s) => s.displayName)
  const token = useAuthStore((s) => s.token)

  const defaultTitle = token && displayName ? `${displayName}的服务主页` : DEFAULT_SHARE_TITLE
  const title = options.title ?? defaultTitle
  const timelineTitle = options.timelineTitle ?? defaultTitle

  // ---- 发送给朋友：path 可控，默认落到「我自己的服务主页」 ----
  useShareAppMessage(() => {
    if (options.path) {
      // 页面自己指定了落地路径，不插手。
      return { title, path: options.path, imageUrl: options.imageUrl }
    }

    const cached = getCachedReferralCode()
    if (cached) {
      // 推广码已缓存 —— 同步就能给出完整链接，不需要等 promise。
      return {
        title,
        path: `${PROVIDER_HOME_PATH}?referralCode=${encodeURIComponent(cached)}`,
        imageUrl: options.imageUrl
      }
    }

    // 还没有推广码（多半是访客，不是服务者）。
    //
    // ⚠️ 这里**不能**直接把 path 写成 PROVIDER_HOME_PATH：
    //    没有推广码的话，客户点开只会看到「未识别到推广码」的报错页。
    //    所以先不指定 path（微信默认分享当前页，至少是个能打开的页面），
    //    同时在 3 秒窗口内尝试取一次推广码，取到就换成我的主页。
    const promise = ensureReferralCode().then((code) => ({
      title,
      path: code
        ? `${PROVIDER_HOME_PATH}?referralCode=${encodeURIComponent(code)}`
        : undefined,
      imageUrl: options.imageUrl
    }))

    return {
      title,
      path: undefined,
      imageUrl: options.imageUrl,
      promise
    }
  })

  // ---- 分享到朋友圈：只能分享当前页，只能追加 query ----
  useShareTimeline(() => {
    const query = options.timelineQuery ?? defaultTimelineQuery()
    return {
      title: timelineTitle,
      query: query || undefined,
      imageUrl: options.imageUrl
    }
  })
}
