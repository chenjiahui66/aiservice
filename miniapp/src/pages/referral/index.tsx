import { useCallback, useEffect, useState } from 'react'
import { View, Text, Image, Button, Video } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import { fetchReferral, fetchReferralStats, fetchMyPage, regenerateQr } from '@/api/provider'
import { usePageData } from '@/hooks/usePageData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { absoluteUrl, copyToClipboard, isWeapp, saveImageToAlbum } from '@/platform'
import { getToken } from '@/utils/token'
import { PROMO_VIDEO_DESC, PROMO_VIDEO_TITLE } from '@/constants/promo-video'
import type { ReferralInfoVO, ReferralStats } from '@/types/domain'

/**
 * 我的推广。
 *
 * 关键：qrMode === 'DEV' 时后端返回的是「开发降级二维码」，不是真实微信小程序码，
 * 必须把后端下发的 qrNotice 原样展示出来，不能装作是真的。
 */
export default function ReferralPage() {
  useAuthGuard()
  const [tab, setTab] = useState<'referral' | 'stats'>('referral')

  const fetcher = useCallback(async () => {
    // fetchMyPage 单独兜底：它只是用来判断要不要显示「主页未开启」告警，
    // 万一它失败，不能把整个推广码面板一起拖垮。失败时按「已开启」处理，
    // 宁可少一次告警，也不要误报把服务者吓一跳。
    const [info, stats, pageEnabled] = await Promise.all([
      fetchReferral(),
      fetchReferralStats(),
      fetchMyPage()
        .then((p) => p.enabled)
        .catch(() => true)
    ])
    return { info, stats, pageEnabled }
  }, [])
  const { data, loading, error, reload } = usePageData(fetcher, [], { refreshOnShow: true })

  return (
    <View className='page'>
      <View className='segmented'>
        <View
          className={`segmented__item ${tab === 'referral' ? 'segmented__item--on' : ''}`}
          onClick={() => setTab('referral')}
        >
          推广码
        </View>
        <View
          className={`segmented__item ${tab === 'stats' ? 'segmented__item--on' : ''}`}
          onClick={() => setTab('stats')}
        >
          推广统计
        </View>
      </View>

      <PageState loading={loading} error={error} skeleton onRetry={reload}>
        {data && tab === 'referral' && (
          <ReferralPanel info={data.info} pageEnabled={data.pageEnabled} onChanged={reload} />
        )}
        {data && tab === 'stats' && <StatsPanel stats={data.stats} />}
      </PageState>

      <View className='setting-group'>
        <View
          className='setting-item'
          onClick={() => Taro.navigateTo({ url: '/pages/page-edit/index' })}
        >
          <Text>服务主页配置</Text>
          <Text className='setting-item__value'>编辑 ›</Text>
        </View>
        <View
          className='setting-item'
          onClick={() => Taro.navigateTo({ url: '/pages/profile/index' })}
        >
          <Text>服务者资料与审核状态</Text>
          <Text className='setting-item__value'>查看 ›</Text>
        </View>
        <View
          className='setting-item'
          onClick={() => Taro.switchTab({ url: '/pages/board/index' })}
        >
          <Text>回到今日台账</Text>
          <Text className='setting-item__value'>›</Text>
        </View>
      </View>

      {/* 意见反馈入口：与服务主页（pages/provider）底部保持同一套样式，
          服务者在推广页就能直接提意见，不用先去「我的」里翻。 */}
      <View
        className='feedback-entry'
        onClick={() => Taro.navigateTo({ url: '/pages/feedback/index' })}
      >
        <Text className='feedback-entry__title'>意见反馈</Text>
        <Text className='feedback-entry__desc'>推广用起来有问题？点这里告诉我们</Text>
        <Text className='feedback-entry__arrow'>›</Text>
      </View>
    </View>
  )
}

/** 推广码 + 二维码 */
function ReferralPanel({
  info,
  pageEnabled,
  onChanged
}: {
  info: ReferralInfoVO
  pageEnabled: boolean
  onChanged: () => void
}) {
  const [generating, setGenerating] = useState(false)
  /** 是否正在看推广指导视频 */
  const [showVideo, setShowVideo] = useState(false)
  const isDev = info.qrMode === 'DEV'
  /**
   * 推广指导视频地址：管理员在管理后台「系统基础设置」里配（promo.video.url），
   * 后端每次返回推广信息时一起下发。为空 = 还没配，就**不显示**这个入口，
   * 免得服务者点开一个播不出来的东西。
   */
  const promoVideoUrl = (info.promoVideoUrl ?? '').trim()

  const onOpenVideo = () => {
    if (!promoVideoUrl) {
      // 不是 bug，是后台还没配。给句人话，别让人以为功能坏了。
      Taro.showToast({ title: '推广指导视频暂未配置', icon: 'none' })
      return
    }
    setShowVideo(true)
  }

  const doGenerate = async () => {
    if (generating) return
    setGenerating(true)
    try {
      await regenerateQr()
      Taro.showToast({ title: '已重新生成', icon: 'success' })
      onChanged()
    } catch {
      /* regenerateQr 内部已 toast */
    } finally {
      setGenerating(false)
    }
  }

  const copyCode = () => copyToClipboard(info.referralCode)

  return (
    <View>
      {/* 主页关着 = 客户扫这个码只会看到「该服务主页已关闭」。
          推广码是注册时就发出去的，服务者自己很容易忘记开这个开关，必须显式提醒。 */}
      {!pageEnabled && (
        <View className='notice notice--danger' style={{ marginBottom: '20rpx' }}>
          <Text className='notice__icon'>⚠</Text>
          <Text>服务主页当前是关闭状态，客户扫码会看到「该服务主页已关闭」，无法预约。</Text>
        </View>
      )}
      {!pageEnabled && (
        <View style={{ marginBottom: '20rpx' }}>
          <Button
            className='btn btn--block'
            onClick={() => Taro.navigateTo({ url: '/pages/page-edit/index' })}
          >
            去开启服务主页
          </Button>
        </View>
      )}

      <View className='card'>
        <View className='code-box'>
          <Text className='code-box__value'>{info.referralCode}</Text>
          <Text className='link' onClick={copyCode}>
            复制
          </Text>
        </View>
        <View style={{ marginTop: '20rpx' }}>
          <Text className='muted'>推广状态：</Text>
          <Text className='muted'>{info.status === 'ENABLED' ? '已启用' : info.status}</Text>
        </View>
      </View>

      {/* 二维码模式提示：DEV 模式必须明示这不是真实小程序码 */}
      <View className={`notice ${isDev ? '' : 'notice--info'}`} style={{ marginBottom: '20rpx' }}>
        <Text className='notice__icon'>{isDev ? '⚠' : 'ⓘ'}</Text>
        <Text>{info.qrNotice || info.qrModeLabel}</Text>
      </View>

      <View className='card'>
        <View className='section-head' style={{ margin: '0 0 8rpx' }}>
          <Text className='section-head__title'>客户扫码预约</Text>
        </View>
        <Text className='subtitle' style={{ display: 'block', marginBottom: '4rpx' }}>
          客户用微信「扫一扫」这个码，就会直接进入你的服务主页：自己挑服务项目、填联系方式提交预约，订单自动落到你的今日台账，不用你再手工录一遍。
        </Text>
        <Text className='muted' style={{ display: 'block', marginBottom: '8rpx' }}>
          {isDev
            ? '当前是普通链接二维码（开发降级），扫出来是网页版；正式发布后会自动换成微信小程序码。'
            : '把码保存到手机，发给客户、贴到微信群或朋友圈都行；客户扫的是你的专属码，订单只会进你的台账。'}
        </Text>

        {showVideo ? (
          <VideoGuidePlayer url={promoVideoUrl} onClose={() => setShowVideo(false)} />
        ) : (
          <QrImage info={info} />
        )}

        {/* 视频推广指导：整行入口，放在「保存到相册」正下方。
            早先做成二维码右侧的小方块，实测太不显眼 —— 服务者根本找不到，
            反馈是「配了但没看到」。整行入口一眼就能看见。 */}
        {!!promoVideoUrl && (
          <View
            className={`video-entry ${promoVideoUrl ? '' : 'video-entry--off'}`}
            onClick={onOpenVideo}
          >
            <View className='video-entry__badge'>▶</View>
            <View className='video-entry__main'>
              <Text className='video-entry__title'>{PROMO_VIDEO_TITLE}</Text>
              <Text className='video-entry__desc'>
                {promoVideoUrl ? PROMO_VIDEO_DESC : '暂未配置视频，可联系平台'}
              </Text>
            </View>
            <Text className='video-entry__arrow'>›</Text>
          </View>
        )}

        <View style={{ marginTop: '24rpx' }}>
          <Button
            className='btn btn--ghost btn--block'
            loading={generating}
            onClick={doGenerate}
          >
            {info.qrImageUrl ? '重新生成二维码' : '生成二维码'}
          </Button>
        </View>

        {!isWeapp() && (
          <Text className='muted' style={{ display: 'block', marginTop: '16rpx', textAlign: 'center' }}>
            小程序码依赖微信，请在微信开发者工具或真机中查看
          </Text>
        )}
      </View>

      <View className='card'>
        <View className='section-head' style={{ margin: '0 0 16rpx' }}>
          <Text className='section-head__title'>推广文案</Text>
          <Text className='link' onClick={() => copyToClipboard(info.shareText)}>
            复制
          </Text>
        </View>
        <Text className='subtitle'>{info.shareText}</Text>
      </View>
    </View>
  )
}

/**
 * 二维码图片。
 * 后端该接口需要登录态，`<Image src>` 无法带 Authorization，
 * 因此用 downloadFile 带 token 拉到临时文件后再展示。
 */
function QrImage({ info }: { info: ReferralInfoVO }) {
  const [localPath, setLocalPath] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!info.qrImageUrl) {
      setState('idle')
      setLocalPath('')
      return
    }
    let cancelled = false
    setState('loading')
    Taro.downloadFile({
      url: absoluteUrl(info.qrImageUrl),
      header: { Authorization: `Bearer ${getToken()}` }
    })
      .then((res) => {
        if (cancelled) return
        if (res.statusCode === 200 && res.tempFilePath) {
          setLocalPath(res.tempFilePath)
          setState('done')
        } else {
          setState('failed')
        }
      })
      .catch(() => {
        if (!cancelled) setState('failed')
      })
    return () => {
      cancelled = true
    }
  }, [info.qrImageUrl])

  const onPreview = () => {
    if (!localPath) return
    Taro.previewImage({ urls: [localPath], current: localPath }).catch(() => {
      Taro.showToast({ title: '预览失败', icon: 'none' })
    })
  }

  const onSave = () => {
    if (!localPath || saving) return
    setSaving(true)
    saveImageToAlbum(localPath).finally(() => setSaving(false))
  }

  if (state === 'idle') {
    return (
      <View className='qr-box'>
        <View className='qr-box__placeholder'>还没有生成二维码，点下方按钮生成</View>
      </View>
    )
  }
  if (state === 'loading') {
    return (
      <View className='qr-box'>
        <View className='qr-box__placeholder'>二维码加载中…</View>
      </View>
    )
  }
  if (state === 'failed') {
    return (
      <View className='qr-box'>
        <View className='qr-box__placeholder'>
          二维码加载失败，请检查网络后重新生成
        </View>
      </View>
    )
  }
  return (
    <View className='qr-box'>
      <Image className='qr-box__image' src={localPath} mode='aspectFit' onClick={onPreview} />
      <Text className='muted' style={{ marginTop: '16rpx' }}>
        {info.qrModeLabel}
      </Text>

      <View className='row' style={{ gap: '16rpx', marginTop: '20rpx', width: '100%' }}>
        <Button
          className='btn btn--ghost grow'
          onClick={onPreview}
        >
          预览大图
        </Button>
        <Button
          className='btn grow'
          loading={saving}
          onClick={onSave}
        >
          保存到相册
        </Button>
      </View>

      <Text className='muted' style={{ display: 'block', marginTop: '12rpx', textAlign: 'center' }}>
        点「保存到相册」存到手机后可发微信 / 朋友圈；也可以长按图片直接保存
      </Text>
    </View>
  )
}

/**
 * 推广指导视频播放器。
 *
 * 播放器整块替换二维码区域，点下面的「返回推广码」退出。
 */
function VideoGuidePlayer({ url, onClose }: { url: string; onClose: () => void }) {
  const [failed, setFailed] = useState(false)

  return (
    <View className='video-player-box'>
      {failed ? (
        <View className='video-player-box__error'>
          <Text className='video-player-box__error-text'>
            视频加载失败：{url}
          </Text>
          <Text className='muted' style={{ display: 'block', marginTop: '8rpx', textAlign: 'center' }}>
            请确认视频地址是 https 直链，且域名已加入小程序的 downloadFile 合法域名
          </Text>
        </View>
      ) : (
        <Video
          className='video-player'
          src={url}
          controls
          autoplay
          objectFit='contain'
          showCenterPlayBtn
          onError={() => setFailed(true)}
        />
      )}

      <View style={{ marginTop: '20rpx' }}>
        <Button className='btn btn--ghost btn--block' onClick={onClose}>
          返回推广码
        </Button>
      </View>
    </View>
  )
}

/** 推广统计：全部为后端真实统计，无固定值 */
function StatsPanel({ stats }: { stats: ReferralStats }) {
  /**
   * ⚠️ completionRate 的单位是**百分比（0~100）**，不是 0~1 的比率。
   *
   * 后端 ReferralCodeService.buildStats 里算的是
   *   Math.round(completedCount * 10000 / total) / 100
   * 也就是「保留两位小数的百分数」，100 表示 100%。
   *
   * 这里以前又乘了一次 100，页面上就显示成了 10000%。
   * clamp 是第二道保险：万一后端哪天改成返回 0~1，
   * 顶多显示成 1%，也绝不会再冒出 10000% 这种一眼假的数字。
   */
  const rate = Math.min(
    100,
    Math.max(0, Math.round(typeof stats.completionRate === 'number' ? stats.completionRate : 0))
  )

  return (
    <View>
      <View className='card'>
        <View className='stats'>
          <View className='stat'>
            <View className='stat__value'>{stats.todayBookingCount}</View>
            <View className='stat__label'>今日预约</View>
          </View>
          <View className='stat'>
            <View className='stat__value'>{stats.weekBookingCount}</View>
            <View className='stat__label'>本周预约</View>
          </View>
          <View className='stat'>
            <View className='stat__value'>{stats.totalBookingCount}</View>
            <View className='stat__label'>累计预约</View>
          </View>
        </View>
      </View>

      <View className='card'>
        <View className='stats'>
          <View className='stat'>
            <View className='stat__value'>{stats.completedCount}</View>
            <View className='stat__label'>已完成</View>
          </View>
          <View className='stat'>
            <View className='stat__value'>{stats.pendingCount}</View>
            <View className='stat__label'>待处理</View>
          </View>
          <View className='stat'>
            <View className='stat__value'>{stats.totalCustomers}</View>
            <View className='stat__label'>客户数</View>
          </View>
        </View>
        <View className='divider' />
        <View className='kv'>
          <Text className='kv__k'>完成率</Text>
          <Text className='kv__v'>{`${rate}%`}</Text>
        </View>
      </View>
    </View>
  )
}