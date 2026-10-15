import { useCallback, useEffect, useState } from 'react'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import { fetchReferral, fetchReferralStats, regenerateQr } from '@/api/provider'
import { usePageData } from '@/hooks/usePageData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { absoluteUrl, copyToClipboard, isWeapp } from '@/platform'
import { getToken } from '@/utils/request'
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
    const [info, stats] = await Promise.all([fetchReferral(), fetchReferralStats()])
    return { info, stats }
  }, [])
  const { data, loading, error, reload } = usePageData(fetcher, [])

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
          <ReferralPanel info={data.info} onChanged={reload} />
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
    </View>
  )
}

/** 推广码 + 二维码 */
function ReferralPanel({ info, onChanged }: { info: ReferralInfoVO; onChanged: () => void }) {
  const [generating, setGenerating] = useState(false)
  const isDev = info.qrMode === 'DEV'

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
        <QrImage info={info} />

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
      <Image className='qr-box__image' src={localPath} mode='aspectFit' />
      <Text className='muted' style={{ marginTop: '16rpx' }}>
        {info.qrModeLabel}
      </Text>
    </View>
  )
}

/** 推广统计：全部为后端真实统计，无固定值 */
function StatsPanel({ stats }: { stats: ReferralStats }) {
  const rate =
    typeof stats.completionRate === 'number' ? Math.round(stats.completionRate * 100) : 0

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