import { useCallback, useState } from 'react'
import { View, Text, Input, Textarea, Button, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import OrderCard from '@/components/OrderCard'
import { fetchCustomerDetail, updateCustomer } from '@/api/provider'
import { usePageData, toMessage } from '@/hooks/usePageData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { getQueryParam, makePhoneCall } from '@/platform'
import { getBookableRange, todayStr, toDateTimeStr, fromDateTimeStr } from '@/utils/date'
import type { CustomerDetailVO, OrderVO } from '@/types/domain'

/** 客户详情：资料 + 复购计划 + 历史订单 */
export default function CustomerDetailPage() {
  useAuthGuard()
  const customerId = Number(getQueryParam('id') || 0)
  const [editing, setEditing] = useState(false)

  const fetcher = useCallback(() => {
    if (!customerId) return Promise.reject(new Error('缺少客户编号'))
    return fetchCustomerDetail(customerId)
  }, [customerId])
  const { data, loading, error, reload } = usePageData<CustomerDetailVO>(fetcher, [customerId])

  const goOrder = (order: OrderVO) => {
    Taro.navigateTo({ url: `/pages/order-detail/index?id=${order.id}` })
  }

  return (
    <View className='page'>
      <PageState loading={loading} error={error} skeleton onRetry={reload}>
        {data && (
          <View>
            <View className='card'>
              <View className='row row--between'>
                <Text className='title'>{data.customer.name}</Text>
                <Text className='tag'>{`${data.customer.orderCount} 单`}</Text>
              </View>
              <View className='divider' />
              <View className='kv'>
                <Text className='kv__k'>手机号</Text>
                <Text className='kv__v link' onClick={() => makePhoneCall(data.customer.phone)}>
                  {data.customer.phone}
                </Text>
              </View>
              <View className='kv'>
                <Text className='kv__k'>服务地址</Text>
                <Text className='kv__v'>{data.customer.address || data.customer.community || '—'}</Text>
              </View>
              <View className='kv'>
                <Text className='kv__k'>首次服务</Text>
                <Text className='kv__v'>{fmt(data.customer.firstServiceAt)}</Text>
              </View>
              <View className='kv'>
                <Text className='kv__k'>最近服务</Text>
                <Text className='kv__v'>{fmt(data.customer.lastServiceAt)}</Text>
              </View>
              {!!data.customer.nextServiceAt && (
                <View className='kv'>
                  <Text className='kv__k'>计划复购</Text>
                  <Text className='kv__v'>{fmt(data.customer.nextServiceAt)}</Text>
                </View>
              )}
              <View style={{ marginTop: '20rpx' }}>
                <Button
                  className='btn btn--ghost btn--block'
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? '收起' : '编辑资料与复购计划'}
                </Button>
              </View>
            </View>

            {editing && <EditCard customerId={customerId} data={data} onSaved={reload} />}

            <View className='section-head'>
              <Text className='section-head__title'>历史订单</Text>
              <Text className='muted'>{`${data.orders.length} 单`}</Text>
            </View>

            {data.orders.length === 0 ? (
              <View className='card'>
                <Text className='muted'>该客户还没有订单记录</Text>
              </View>
            ) : (
              data.orders.map((order) => (
                <OrderCard key={order.id} order={order} onClick={goOrder} />
              ))
            )}
          </View>
        )}
      </PageState>
    </View>
  )
}

function fmt(v: string | null | undefined): string {
  if (!v) return '—'
  return fromDateTimeStr(v)
}

/** 编辑客户资料与复购计划 */
function EditCard({
  customerId,
  data,
  onSaved
}: {
  customerId: number
  data: CustomerDetailVO
  onSaved: () => void
}) {
  const [name, setName] = useState(data.customer.name || '')
  const [phone, setPhone] = useState(data.customer.phone || '')
  const [community, setCommunity] = useState(data.customer.community || '')
  const [address, setAddress] = useState(data.customer.address || '')
  const [nextServiceAt, setNextServiceAt] = useState(
    fromDateTimeStr(data.customer.nextServiceAt)
  )
  const [saving, setSaving] = useState(false)

  const { start, end } = getBookableRange({})

  const save = async () => {
    if (saving) return
    if (!name.trim()) {
      Taro.showToast({ title: '请填写客户姓名', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await updateCustomer(customerId, {
        name: name.trim(),
        phone: phone.trim(),
        community: community.trim(),
        address: address.trim(),
        // ⚠️ 必须补时间部分：Picker 给的是 "2026-10-25"，
        //    后端 nextServiceAt 是 LocalDateTime，直接发纯日期会反序列化失败，
        //    报「请求体格式不正确」——用户看到的就是「保存没反应」。
        nextServiceAt: nextServiceAt ? toDateTimeStr(nextServiceAt) : null
      })
      Taro.showToast({ title: '已保存', icon: 'success' })
      onSaved()
    } catch (e) {
      Taro.showToast({ title: toMessage(e), icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='card'>
      <View className='section-head' style={{ margin: '0 0 16rpx' }}>
        <Text className='section-head__title'>编辑</Text>
      </View>

      <Item label='姓名'>
        <Input
          className='form-item__control'
          value={name}
          maxlength={20}
          onInput={(e) => setName(e.detail.value)}
        />
      </Item>

      <Item label='手机号'>
        <Input
          className='form-item__control'
          type='number'
          value={phone}
          maxlength={11}
          onInput={(e) => setPhone(e.detail.value)}
        />
      </Item>

      <Item label='小区'>
        <Input
          className='form-item__control'
          value={community}
          maxlength={60}
          onInput={(e) => setCommunity(e.detail.value)}
        />
      </Item>

      <Item label='详细地址'>
        <Textarea
          className='form-item__control form-item__control--textarea'
          value={address}
          maxlength={200}
          onInput={(e) => setAddress(e.detail.value)}
        />
      </Item>

      <Item label='下次复购日期'>
        <Picker
          mode='date'
          value={nextServiceAt}
          start={todayStr()}
          end={end || start}
          onChange={(e) => setNextServiceAt(e.detail.value)}
        >
          <View className='form-item__control'>
            <Text className={nextServiceAt ? '' : 'form-item__placeholder'}>
              {nextServiceAt || '选择复购日期'}
            </Text>
          </View>
        </Picker>
      </Item>

      <Button className='btn btn--block' loading={saving} disabled={saving} onClick={save}>
        保存
      </Button>
    </View>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className='form-item'>
      <View className='form-item__label'>
        <Text>{label}</Text>
      </View>
      {children}
    </View>
  )
}