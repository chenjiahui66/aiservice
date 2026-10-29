import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Button, Switch } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import FormField from '@/components/FormField'
import { createManualOrder } from '@/api/provider'
import { fetchServiceItems } from '@/api/public'
import { usePageData, toMessage } from '@/hooks/usePageData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import {
  buildInitialValues,
  parseBookingRules,
  parseFormFields,
  validateValues
} from '@/utils/form-config'
import type { ManualOrderRequest, ServiceItem } from '@/types/domain'

/**
 * 手动记单（线下成交补录）。
 *
 * 表单同样是「按服务项目的 formFields 配置动态渲染」，
 * 而不是在这里写死「代扔垃圾」这类具体字段。
 */
export default function OrderCreatePage() {
  useAuthGuard()
  const [activeItemId, setActiveItemId] = useState<number | null>(null)
  const [values, setValues] = useState<Record<string, string | number>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const fetcher = useCallback(() => fetchServiceItems(), [])
  const { data: items, loading, error, reload } = usePageData<ServiceItem[]>(fetcher, [])

  useEffect(() => {
    if (!items || !items.length) return
    if (activeItemId === null) {
      setActiveItemId(items[0].id)
      return
    }
    // 切换服务项目时重置表单
    const target = items.find((i) => i.id === activeItemId)
    if (target) {
      const next = buildInitialValues(parseFormFields(target.formFields))
      // serviceItemId 在 formFields 中是必填项，必须预置当前项目，否则校验永远不通过
      setValues({ ...next, serviceItemId: target.id })
      setErrors({})
    }
  }, [items, activeItemId])

  const activeItem = useMemo(
    () => items?.find((i) => i.id === activeItemId) || null,
    [items, activeItemId]
  )
  const fields = useMemo(() => {
    if (!activeItem) return []
    // 服务项目由顶部选择器决定；formFields 里同名的 serviceItem 项不再重复渲染，
    // 否则可能出现「选了 A 的时段规则、提交 B 的项目」这种不一致。
    return parseFormFields(activeItem.formFields).filter((f) => f.type !== 'serviceItem')
  }, [activeItem])
  const rules = useMemo(
    () => (activeItem ? parseBookingRules(activeItem.bookingRules) : {}),
    [activeItem]
  )

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
    const result = validateValues(fields, values)
    if (!result.valid) {
      setErrors(result.errors)
      Taro.showToast({ title: '请检查表单填写', icon: 'none' })
      return
    }

    // 只取后端手动记单接口认识的字段；不传 providerId，归属由后端裁决
    const payload: ManualOrderRequest = {
      customerName: String(values.customerName || '').trim(),
      customerPhone: String(values.customerPhone || '').trim(),
      community: String(values.community || '').trim() || undefined,
      address: String(values.address || '').trim(),
      serviceItemId: activeItem.id,
      bookingDate: String(values.bookingDate || '').trim(),
      bookingSlot: String(values.bookingSlot || '').trim(),
      quantity: values.quantity ? Number(values.quantity) : 1,
      serviceDesc: String(values.serviceDesc || '').trim() || undefined,
      confirmed
    }

    if (!payload.customerName || !payload.address || !payload.bookingDate || !payload.bookingSlot) {
      Taro.showToast({ title: '请填写完整的记单信息', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const created = await createManualOrder(payload)
      Taro.showToast({ title: '记单成功', icon: 'success' })
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/order-detail/index?id=${created.id}` })
      }, 700)
    } catch (e) {
      Taro.showToast({ title: toMessage(e), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='page'>
      <PageState
        loading={loading}
        error={error}
        empty={!error && !!items && items.length === 0}
        emptyTitle='暂无可用的服务项目'
        emptyDesc='请先在「我的服务类目」里勾选你提供的服务项。'
        skeleton
        onRetry={reload}
      >
        {items && items.length > 0 && (
          <View>
            <View className='card'>
              <View className='section-head' style={{ margin: '0 0 16rpx' }}>
                <Text className='section-head__title'>服务项目</Text>
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
              {!!activeItem?.priceDesc && (
                <Text className='muted' style={{ display: 'block', marginTop: '16rpx' }}>
                  {activeItem.priceDesc}
                </Text>
              )}
            </View>

            {fields.length === 0 ? (
              <View className='notice'>
                <Text className='notice__icon'>⚠</Text>
                <Text>该服务项目未配置表单字段，无法记单。</Text>
              </View>
            ) : (
              <View className='card'>
                {fields.map((field) => (
                  <FormField
                    key={field.key}
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
              <View className='row row--between'>
                <View className='grow'>
                  <Text className='subtitle'>客户已确认预约</Text>
                  <Text className='muted'>线下已谈妥可关闭此开关</Text>
                </View>
                <Switch
                  checked={confirmed}
                  color='#2B6CF0'
                  onChange={(e) => setConfirmed(e.detail.value)}
                />
              </View>
            </View>

            <Button
              className='btn btn--block btn--lg'
              loading={submitting}
              disabled={submitting || !activeItem}
              onClick={onSubmit}
            >
              提交记单
            </Button>
            <View className='footer-spacer' />
          </View>
        )}
      </PageState>
    </View>
  )
}