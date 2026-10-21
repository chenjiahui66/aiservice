import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import FormField from '@/components/FormField'
import ConsentCheckbox from '@/components/ConsentCheckbox'
import { fetchProviderHome, submitBooking } from '@/api/public'
import { usePageData, toMessage } from '@/hooks/usePageData'
import { getQueryParam, isWeapp } from '@/platform'
import { POLICY_VERSION } from '@/constants/policy'
import {
  buildInitialValues,
  parseBookingRules,
  parseFormFields,
  validateValues
} from '@/utils/form-config'
import type { BookingRequest, BookingResult, ProviderHomeVO, ServiceItem } from '@/types/domain'

/**
 * 预约提交页（客户扫码路径，独立页面，不需要登录）。
 *
 * 表单完全由服务项目的 formFields 配置驱动：
 * 解析 JSON 字符串 → 逐项渲染 → 校验 → 组装请求体。
 * 提交时 **只传 referralCode**，不传 providerId：订单归属由后端反查裁决。
 */
export default function BookingPage() {
  const referralCode = getQueryParam('referralCode') || ''
  const preselectedId = Number(getQueryParam('serviceItemId') || 0)

  const [activeItemId, setActiveItemId] = useState<number | null>(
    preselectedId || null
  )
  const [values, setValues] = useState<Record<string, string | number>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [privacyError, setPrivacyError] = useState('')
  const [policyAgreed, setPolicyAgreed] = useState(false)
  const [policyError, setPolicyError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<BookingResult | null>(null)

  const fetcher = useCallback(() => {
    if (!referralCode) {
      return Promise.reject(new Error('未识别到推广码，请返回上一页重新进入'))
    }
    return fetchProviderHome(referralCode)
  }, [referralCode])
  const { data, loading, error, reload } = usePageData<ProviderHomeVO>(fetcher, [referralCode])

  const items: ServiceItem[] = useMemo(() => data?.serviceItems || [], [data])

  // 选定服务项目后按其配置初始化表单
  useEffect(() => {
    if (!items.length) return
    const target =
      items.find((i) => i.id === activeItemId) ||
      items.find((i) => i.id === preselectedId) ||
      items[0]
    if (target.id !== activeItemId) {
      setActiveItemId(target.id)
      return
    }
    const fields = parseFormFields(target.formFields)
    setValues(buildInitialValues(fields))
    // serviceItem 默认选中当前项目
    setValues((prev) => ({ ...prev, serviceItemId: target.id }))
    setErrors({})
  }, [items, preselectedId, activeItemId])

  const activeItem = useMemo(
    () => items.find((i) => i.id === activeItemId) || null,
    [items, activeItemId]
  )
  const fields = useMemo(() => {
    if (!activeItem) return []
    // 服务项目由顶部选择器决定；formFields 里同名的 serviceItem 项不再重复渲染，
    // 避免出现「用 A 的时段规则、提交 B 的项目」这种不一致。
    return parseFormFields(activeItem.formFields).filter((f) => f.type !== 'serviceItem')
  }, [activeItem])
  const rules = useMemo(() => (activeItem ? parseBookingRules(activeItem.bookingRules) : {}), [activeItem])

  const onFieldChange = (key: string, value: string | number) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const onSubmit = async () => {
    if (submitting || !activeItem) return

    const check = validateValues(fields, values)
    if (!check.valid) {
      setErrors(check.errors)
      Taro.showToast({ title: '请检查表单填写', icon: 'none' })
      return
    }
    if (!privacyAccepted) {
      setPrivacyError('请先阅读并同意说明')
      Taro.showToast({ title: '请先同意服务说明', icon: 'none' })
      return
    }
    // 客户的姓名、手机号、地址属于个人信息，收集前必须取得明示同意
    if (!policyAgreed) {
      setPolicyError('请先阅读并同意《隐私政策》')
      Taro.showToast({ title: '请先同意隐私政策', icon: 'none' })
      return
    }
    setPrivacyError('')
    setPolicyError('')

    // 服务项目以当前选择的项目为准（表单里已不再重复渲染 serviceItem）
    const pickedItemId = activeItem.id

    // ⚠️ 请求体不含 providerId：后端按 referralCode 反查服务者归属
    const payload: BookingRequest = {
      referralCode,
      serviceItemId: pickedItemId,
      customerName: String(values.customerName || '').trim(),
      customerPhone: String(values.customerPhone || '').trim(),
      community: String(values.community || '').trim() || undefined,
      address: String(values.address || '').trim(),
      bookingDate: String(values.bookingDate || '').trim(),
      bookingSlot: String(values.bookingSlot || '').trim(),
      quantity: values.quantity ? Number(values.quantity) : 1,
      serviceDesc: String(values.serviceDesc || '').trim() || undefined,
      remark: String(values.remark || '').trim() || undefined,
      privacyAccepted: true,
      policyVersion: POLICY_VERSION,
      channel: isWeapp() ? 'WECHAT_MOMENTS' : 'DIRECT'
    }

    setSubmitting(true)
    try {
      const res = await submitBooking(payload)
      setResult(res)
    } catch (e) {
      Taro.showToast({ title: toMessage(e), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <View className='page'>
        <View className='card'>
          <View className='result'>
            <View className='result__glyph'>✓</View>
            <View className='result__title'>预约已提交</View>
            <View className='result__msg'>{result.message}</View>
          </View>
          <View className='divider' />
          <View className='kv'>
            <Text className='kv__k'>订单号</Text>
            <Text className='kv__v mono'>{result.orderNo}</Text>
          </View>
          <View className='kv'>
            <Text className='kv__k'>当前状态</Text>
            <Text className='kv__v'>{result.statusLabel}</Text>
          </View>
          {!!result.providerDisplayName && (
            <View className='kv'>
              <Text className='kv__k'>服务者</Text>
              <Text className='kv__v'>{result.providerDisplayName}</Text>
            </View>
          )}
        </View>
        <Button className='btn btn--block btn--lg' onClick={() => Taro.navigateBack()}>
          返回服务主页
        </Button>
      </View>
    )
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
            <View className='card'>
              <View className='subtitle'>{data.displayName}</View>
              {!!data.serviceArea && (
                <Text className='muted' style={{ display: 'block', marginTop: '6rpx' }}>
                  {`服务区域：${data.serviceArea}`}
                </Text>
              )}
            </View>

            {items.length > 1 && (
              <View className='card'>
                <View className='section-head' style={{ margin: '0 0 16rpx' }}>
                  <Text className='section-head__title'>选择服务项目</Text>
                </View>
                <View className='chips'>
                  {items.map((item) => (
                    <View
                      key={item.id}
                      className={`chip ${item.id === activeItemId ? 'chip--on' : ''}`}
                      onClick={() => setActiveItemId(item.id)}
                    >
                      {item.name}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {fields.length === 0 ? (
              <View className='notice'>
                <Text className='notice__icon'>⚠</Text>
                <Text>该服务项目暂未配置预约表单，请联系服务者。</Text>
              </View>
            ) : (
              <View className='card'>
                {fields.map((field) => (
                  <FormField
                    key={`${activeItemId}-${field.key}`}
                    field={field}
                    value={values[field.key] ?? ''}
                    error={errors[field.key]}
                    values={values}
                    bookingRules={rules}
                    serviceItems={items}
                    onChange={onFieldChange}
                  />
                ))}
              </View>
            )}

            <View className='card'>
              <View
                className='checkline'
                onClick={() => {
                  setPrivacyAccepted(!privacyAccepted)
                  setPrivacyError('')
                }}
              >
                <View className={`checkbox ${privacyAccepted ? 'checkbox--on' : ''}`}>✓</View>
                <View className='grow'>
                  <Text>
                    我已知悉：{data.displayName} 为个人服务者，本平台仅提供预约工具，服务由服务者本人独立完成。
                  </Text>
                  {!!privacyError && (
                    <Text className='form-item__error' style={{ display: 'block' }}>
                      {privacyError}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* 隐私政策同意：客户的姓名、手机号、地址属于个人信息，
                提交前必须明示用途并取得同意。 */}
            <View className='card'>
              <ConsentCheckbox
                checked={policyAgreed}
                error={policyError}
                note='你填写的姓名、手机号、小区与详细地址，仅用于向该服务者提交预约并由其上门服务。'
                onChange={(v) => {
                  setPolicyAgreed(v)
                  if (v) setPolicyError('')
                }}
              />
            </View>

            {!!activeItem?.notes && (
              <View className='notice' style={{ marginBottom: '20rpx' }}>
                <Text className='notice__icon'>ⓘ</Text>
                <Text>{activeItem.notes}</Text>
              </View>
            )}

            <Button
              className='btn btn--block btn--lg'
              loading={submitting}
              disabled={submitting || !activeItem || fields.length === 0}
              onClick={onSubmit}
            >
              提交预约
            </Button>
          </View>
        )}
      </PageState>
    </View>
  )
}