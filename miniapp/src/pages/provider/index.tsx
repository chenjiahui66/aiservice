import { useCallback, useMemo } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import { fetchProviderHome } from '@/api/public'
import { usePageData, toMessage } from '@/hooks/usePageData'
import { getLaunchReferralCode, getQueryParam, makePhoneCall } from '@/platform'
import type { ProviderHomeVO, ServiceItem } from '@/types/domain'

/**
 * 服务主页展示页（客户扫码落地页，独立路径，不需要进入服务者工作台）。
 *
 * 推广码来源：
 *  - 微信小程序码：Taro.getEnterOptionsSync().query.scene（需 decodeURIComponent）
 *  - 非微信 / 手动传参：URL query 的 referralCode
 */
export default function ProviderHomePage() {
  const referralCode = useMemo(
    () => getQueryParam('referralCode') || getLaunchReferralCode() || '',
    []
  )

  const fetcher = useCallback(() => {
    if (!referralCode) {
      return Promise.reject(new Error('未识别到推广码，请重新扫码或向服务者索取'))
    }
    return fetchProviderHome(referralCode)
  }, [referralCode])

  const { data, loading, error, reload } = usePageData<ProviderHomeVO>(fetcher, [referralCode])

  const goBooking = (item: ServiceItem) => {
    Taro.navigateTo({
      url: `/pages/booking/index?referralCode=${encodeURIComponent(referralCode)}&serviceItemId=${item.id}`
    })
  }

  return (
    <View className='page'>
      <PageState
        loading={loading}
        error={error}
        onRetry={reload}
      >
        {data && (
          <View>
            <View className='provider-hero'>
              <View className='provider-hero__avatar'>
                {(data.displayName || '服').slice(0, 1)}
              </View>
              <View className='provider-hero__name'>{data.displayName}</View>
              {!!data.serviceArea && (
                <View className='provider-hero__area'>{`服务区域：${data.serviceArea}`}</View>
              )}

              <View className='provider-hero__tags'>
                {!!data.availableTime && <Text className='tag'>{data.availableTime}</Text>}
                {!!data.priceDesc && <Text className='tag tag--pending'>{data.priceDesc}</Text>}
              </View>

              {!!data.intro && (
                <View style={{ marginTop: '20rpx' }}>
                  <Text className='subtitle'>{data.intro}</Text>
                </View>
              )}

              {!!data.contactVisible && !!data.contactPhone && (
                <View style={{ marginTop: '24rpx' }}>
                  <Button className='btn btn--ghost' onClick={() => makePhoneCall(data.contactPhone)}>
                    联系服务者
                  </Button>
                </View>
              )}
            </View>

            {!!data.serviceRules && (
              <View className='notice notice--info' style={{ marginBottom: '20rpx' }}>
                <Text className='notice__icon'>ⓘ</Text>
                <Text>{data.serviceRules}</Text>
              </View>
            )}

            <View className='card'>
              <View className='section-head' style={{ margin: '0 0 8rpx' }}>
                <Text className='section-head__title'>可预约服务</Text>
              </View>

              {data.serviceItems.length === 0 ? (
                <Text className='muted'>该服务者暂未开放可预约的服务项目</Text>
              ) : (
                data.serviceItems.map((item) => (
                  <View key={item.id} className='service-item'>
                    <View className='service-item__head'>
                      <Text className='service-item__name'>{item.name}</Text>
                      {!!item.priceDesc && <Text className='service-item__price'>{item.priceDesc}</Text>}
                    </View>
                    {!!item.description && (
                      <View className='service-item__desc'>{item.description}</View>
                    )}
                    {!!item.notes && <View className='service-item__notes'>{item.notes}</View>}
                    <View className='service-item__action'>
                      <Button
                        className='btn btn--block'
                        onClick={() => goBooking(item)}
                      >
                        {`预约${item.name}`}
                      </Button>
                    </View>
                  </View>
                ))
              )}
            </View>

            {!!data.disclaimer && (
              <View className='notice' style={{ marginTop: '20rpx' }}>
                <Text className='notice__icon'>ⓘ</Text>
                <Text>{data.disclaimer}</Text>
              </View>
            )}

            <View
              className='feedback-entry'
              onClick={() =>
                Taro.navigateTo({
                  url: `/pages/feedback/index?referralCode=${encodeURIComponent(referralCode)}`
                })
              }
            >
              <Text className='feedback-entry__title'>意见反馈</Text>
              <Text className='feedback-entry__desc'>有建议或遇到问题？点这里告诉我们</Text>
              <Text className='feedback-entry__arrow'>›</Text>
            </View>
          </View>
        )}
      </PageState>
    </View>
  )
}