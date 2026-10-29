import { useCallback, useEffect, useState } from 'react'
import { View, Text, Input, Textarea, Switch, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import { fetchMyPage, updateMyPage } from '@/api/provider'
import { usePageData, toMessage } from '@/hooks/usePageData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import type { ProviderPageConfig } from '@/types/domain'

type FormState = {
  displayName: string
  intro: string
  serviceArea: string
  availableTime: string
  priceDesc: string
  serviceRules: string
  contactVisible: boolean
  contactPhone: string
  enabled: boolean
}

const EMPTY: FormState = {
  displayName: '',
  intro: '',
  serviceArea: '',
  availableTime: '',
  priceDesc: '',
  serviceRules: '',
  contactVisible: true,
  contactPhone: '',
  enabled: true
}

/** 个人服务主页编辑 */
export default function PageEditPage() {
  useAuthGuard()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const fetcher = useCallback(() => fetchMyPage(), [])
  const { data, loading, error, reload } = usePageData<ProviderPageConfig>(fetcher, [])

  useEffect(() => {
    if (!data) return
    setForm({
      displayName: data.displayName || '',
      intro: data.intro || '',
      serviceArea: data.serviceArea || '',
      availableTime: data.availableTime || '',
      priceDesc: data.priceDesc || '',
      serviceRules: data.serviceRules || '',
      contactVisible: !!data.contactVisible,
      contactPhone: data.contactPhone || '',
      enabled: !!data.enabled
    })
  }, [data])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const onSave = async () => {
    if (saving) return
    if (!form.displayName.trim()) {
      Taro.showToast({ title: '请填写主页名称', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await updateMyPage({
        displayName: form.displayName.trim(),
        intro: form.intro.trim(),
        serviceArea: form.serviceArea.trim(),
        availableTime: form.availableTime.trim(),
        priceDesc: form.priceDesc.trim(),
        serviceRules: form.serviceRules.trim(),
        contactVisible: form.contactVisible,
        contactPhone: form.contactVisible ? form.contactPhone.trim() : null,
        enabled: form.enabled
      })
      Taro.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (e) {
      Taro.showToast({ title: toMessage(e), icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='page'>
      <PageState loading={loading} error={error} skeleton onRetry={reload}>
        <View>
          {!form.enabled && (
            <View className='notice' style={{ marginBottom: '20rpx' }}>
              <Text className='notice__icon'>⚠</Text>
              <Text>主页当前处于关闭状态，客户扫码后看不到你的服务内容。</Text>
            </View>
          )}

          <View className='card'>
            <Item label='主页名称' required>
              <Input
                className='form-item__control'
                value={form.displayName}
                maxlength={40}
                placeholder='如：张师傅 · 上门代扔垃圾'
                placeholderClass='form-item__placeholder'
                onInput={(e) => set('displayName', e.detail.value)}
              />
            </Item>

            <Item label='服务区域'>
              <Input
                className='form-item__control'
                value={form.serviceArea}
                maxlength={60}
                placeholder='如：阳光小区'
                placeholderClass='form-item__placeholder'
                onInput={(e) => set('serviceArea', e.detail.value)}
              />
            </Item>

            <Item label='个人介绍'>
              <Textarea
                className='form-item__control form-item__control--textarea'
                value={form.intro}
                maxlength={200}
                placeholder='简单介绍你的服务'
                placeholderClass='form-item__placeholder'
                onInput={(e) => set('intro', e.detail.value)}
              />
            </Item>

            <Item label='可预约时间'>
              <Input
                className='form-item__control'
                value={form.availableTime}
                maxlength={60}
                placeholder='如：每天 9:00-18:00'
                placeholderClass='form-item__placeholder'
                onInput={(e) => set('availableTime', e.detail.value)}
              />
            </Item>

            <Item label='价格说明'>
              <Input
                className='form-item__control'
                value={form.priceDesc}
                maxlength={60}
                placeholder='如：10~30 元/次'
                placeholderClass='form-item__placeholder'
                onInput={(e) => set('priceDesc', e.detail.value)}
              />
            </Item>

            <Item label='服务规则'>
              <Textarea
                className='form-item__control form-item__control--textarea'
                value={form.serviceRules}
                maxlength={200}
                placeholder='如：需提前一天预约，现金支付'
                placeholderClass='form-item__placeholder'
                onInput={(e) => set('serviceRules', e.detail.value)}
              />
            </Item>

            <View className='form-item'>
              <View className='form-item__label'>
                <Text>展示联系电话</Text>
              </View>
              <View className='row row--between'>
                <Text className='muted grow'>
                  {form.contactVisible ? '客户可见号码' : '不对外展示号码'}
                </Text>
                <Switch
                  checked={form.contactVisible}
                  color='#2B6CF0'
                  onChange={(e) => set('contactVisible', e.detail.value)}
                />
              </View>
            </View>

            {form.contactVisible && (
              <Item label='联系电话'>
                <>
                  {/* 默认值由后端带下来：注册 / 登录时已经把账号手机号写进主页了，
                      服务者不用自己敲一遍；想换成别的号码照样可以改。 */}
                  <Input
                    className='form-item__control'
                    type='number'
                    value={form.contactPhone}
                    maxlength={11}
                    placeholder='客户可直接拨打'
                    placeholderClass='form-item__placeholder'
                    onInput={(e) => set('contactPhone', e.detail.value)}
                  />
                  <Text className='muted' style={{ display: 'block', marginTop: '10rpx', fontSize: '23rpx' }}>
                    默认已填入你的注册手机号，也可以改成其它号码。
                  </Text>
                </>
              </Item>
            )}

            <View className='form-item'>
              <View className='form-item__label'>
                <Text>开启主页</Text>
              </View>
              <View className='row row--between'>
                <Text className='muted grow'>关闭后客户扫码将无法查看服务内容</Text>
                <Switch
                  checked={form.enabled}
                  color='#2B6CF0'
                  onChange={(e) => set('enabled', e.detail.value)}
                />
              </View>
            </View>
          </View>

          <Button
            className='btn btn--block btn--lg'
            loading={saving}
            disabled={saving}
            onClick={onSave}
          >
            保存
          </Button>

          {/* 主页上「可预约服务」列的就是这里勾的类目 —— 紧挨着保存按钮放，
              服务者改完主页顺手就能调整自己提供哪几项。 */}
          <View
            className='setting-item setting-item--link'
            onClick={() => Taro.navigateTo({ url: '/pages/service-items/index' })}
          >
            <Text>可预约服务</Text>
            <Text className='setting-item__value'>选择我提供哪几项 ›</Text>
          </View>

          <View className='footer-spacer' />
        </View>
      </PageState>
    </View>
  )
}

function Item({
  label,
  required,
  children
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <View className='form-item'>
      <View className='form-item__label'>
        {required && <Text className='form-item__required'>*</Text>}
        <Text>{label}</Text>
      </View>
      {children}
    </View>
  )
}