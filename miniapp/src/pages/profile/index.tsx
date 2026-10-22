import { useCallback, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import { AuditStatusTag } from '@/components/StatusTag'
import { fetchProfile } from '@/api/auth'
import { usePageData } from '@/hooks/usePageData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useAuthStore } from '@/store/auth'
import type { ProviderProfile } from '@/types/domain'

/**
 * 服务者资料：重点展示审核状态与驳回原因，
 * 让服务者清楚知道「现在能不能对外接单」。
 */
export default function ProfilePage() {
  useAuthGuard()
  const setAuditStatus = useAuthStore((s) => s.setAuditStatus)
  // 驳回原因只在登录/注册响应里下发，profile 接口不返回，因此从登录态读取
  const storeRemark = useAuthStore((s) => s.auditRemark)

  const fetcher = useCallback(async () => {
    const p = await fetchProfile()
    // 同步审核状态到本地 store；驳回原因保持登录时拿到的值
    setAuditStatus(p.auditStatus, storeRemark)
    return p
  }, [setAuditStatus, storeRemark])
  const { data, loading, error, reload } = usePageData<ProviderProfile>(fetcher, [], {
    refreshOnShow: true
  })

  const bannerClass =
    data?.auditStatus === 'APPROVED'
      ? 'audit-banner audit-banner--approved'
      : data?.auditStatus === 'REJECTED'
        ? 'audit-banner audit-banner--rejected'
        : 'audit-banner audit-banner--pending'

  return (
    <View className='page'>
      <PageState loading={loading} error={error} skeleton onRetry={reload}>
        {data && (
          <View>
            <View className={bannerClass}>
              <Text className='audit-banner__badge'>{data.auditStatusLabel}</Text>
              <View className='grow'>
                {data.auditStatus === 'APPROVED' && <Text>审核已通过，可以正常接收客户预约。</Text>}
                {data.auditStatus === 'PENDING' && (
                  <Text>资料正在审核中，通过后客户才能扫码看到你的服务主页。</Text>
                )}
                {data.auditStatus === 'REJECTED' && (
                  <Text>审核未通过，请根据驳回原因修改资料后联系平台。</Text>
                )}
              </View>
            </View>

            {data.auditStatus === 'REJECTED' && (
              <View className='notice notice--danger' style={{ marginBottom: '20rpx' }}>
                <Text className='notice__icon'>⚠</Text>
                <Text>驳回原因：{storeRemark || '平台未提供具体说明'}</Text>
              </View>
            )}

            <View className='card'>
              <View className='kv'>
                <Text className='kv__k'>真实姓名</Text>
                <Text className='kv__v'>{data.realName}</Text>
              </View>
              <View className='kv'>
                <Text className='kv__k'>登录手机号</Text>
                <Text className='kv__v'>{data.phone}</Text>
              </View>
              <View className='kv'>
                <Text className='kv__k'>服务区域</Text>
                <Text className='kv__v'>{data.serviceArea || '未填写'}</Text>
              </View>
              <View className='kv'>
                <Text className='kv__k'>账号状态</Text>
                <Text className='kv__v'>
                  {data.enabled === 'ENABLED' ? '正常' : '已停用'}
                </Text>
              </View>
              <View className='kv'>
                <Text className='kv__k'>审核状态</Text>
                <Text className='kv__v'>
                  <AuditStatusTag status={data.auditStatus} label={data.auditStatusLabel} />
                </Text>
              </View>
            </View>

            <View className='btn-row' style={{ marginTop: '20rpx' }}>
              <Button
                className='btn btn--ghost'
                onClick={() => Taro.navigateTo({ url: '/pages/page-edit/index' })}
              >
                编辑服务主页
              </Button>
              <Button
                className='btn btn--ghost'
                onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}
              >
                账号与设置
              </Button>
            </View>
          </View>
        )}
      </PageState>
    </View>
  )
}