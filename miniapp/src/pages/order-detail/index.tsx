import { useCallback, useState } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import PromptModal from '@/components/PromptModal'
import { OrderStatusTag } from '@/components/StatusTag'
import {
  cancelOrder,
  completeOrder,
  confirmOrder,
  fetchOrderDetail,
  startOrder,
  updateOrderNote
} from '@/api/provider'
import { usePageData, toMessage } from '@/hooks/usePageData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { getQueryParam } from '@/platform'
import { makePhoneCall } from '@/platform'
import type { OrderVO } from '@/types/domain'

/**
 * 订单详情。
 * 底部操作按钮按订单状态机给出：待确认→确认 / 已预约→开始服务 / 服务中→完成。
 * 非法流转由后端裁决（42003），这里只呈现当前合法动作。
 */
export default function OrderDetailPage() {
  useAuthGuard()
  const orderId = Number(getQueryParam('id') || 0)
  const [acting, setActing] = useState('')

  const fetcher = useCallback(() => {
    if (!orderId) return Promise.reject(new Error('缺少订单编号'))
    return fetchOrderDetail(orderId)
  }, [orderId])
  const { data: order, loading, error, reload } = usePageData<OrderVO>(fetcher, [orderId])

  const run = async (key: string, fn: () => Promise<unknown>, okText: string) => {
    if (acting) return
    setActing(key)
    try {
      await fn()
      Taro.showToast({ title: okText, icon: 'success' })
      reload()
    } catch (e) {
      Taro.showToast({ title: toMessage(e), icon: 'none' })
    } finally {
      setActing('')
    }
  }

  const [prompt, setPrompt] = useState<'cancel' | 'complete' | null>(null)

  const onSubmitCancel = async (reason: string) => {
    setPrompt(null)
    await run('cancel', () => cancelOrder(orderId, reason), '已取消')
  }

  const onSubmitComplete = async (remark: string) => {
    setPrompt(null)
    await run('complete', () => completeOrder(orderId, remark), '已完成')
  }

  return (
    <View className='page'>
      <PageState
        loading={loading}
        error={error}
        skeleton
        onRetry={reload}
      >
        {order && (
          <View>
            <View className='hero'>
              <View className='row row--between'>
                <View>
                  <View className='order-card__time'>{order.bookingSlot}</View>
                  <View className='hero__sub'>{order.bookingDate}</View>
                </View>
                <OrderStatusTag status={order.status} label={order.statusLabel} />
              </View>
            </View>

            <View className='card'>
              <View className='kv'>
                <Text className='kv__k'>订单号</Text>
                <Text className='kv__v mono'>{order.orderNo}</Text>
              </View>
              <View className='kv'>
                <Text className='kv__k'>服务项目</Text>
                <Text className='kv__v'>{order.serviceName}</Text>
              </View>
              <View className='kv'>
                <Text className='kv__k'>服务数量</Text>
                <Text className='kv__v'>{order.quantity}</Text>
              </View>
              <View className='kv'>
                <Text className='kv__k'>服务地址</Text>
                <Text className='kv__v'>{order.address}</Text>
              </View>
              {order.community && (
                <View className='kv'>
                  <Text className='kv__k'>所在小区</Text>
                  <Text className='kv__v'>{order.community}</Text>
                </View>
              )}
              <View className='kv'>
                <Text className='kv__k'>客户</Text>
                <Text
                  className='kv__v link'
                  onClick={() => Taro.navigateTo({ url: `/pages/customer-detail/index?id=${order.customerId}` })}
                >
                  {order.customerName}
                </Text>
              </View>
              <View className='kv'>
                <Text className='kv__k'>联系电话</Text>
                <Text className='kv__v link' onClick={() => makePhoneCall(order.customerPhone)}>
                  {order.customerPhone}
                </Text>
              </View>
              {!!order.serviceDesc && (
                <View className='kv'>
                  <Text className='kv__k'>服务内容</Text>
                  <Text className='kv__v'>{order.serviceDesc}</Text>
                </View>
              )}
              {!!order.customerRemark && (
                <View className='kv'>
                  <Text className='kv__k'>客户备注</Text>
                  <Text className='kv__v'>{order.customerRemark}</Text>
                </View>
              )}
              {!!order.providerNote && (
                <View className='kv'>
                  <Text className='kv__k'>服务备注</Text>
                  <Text className='kv__v'>{order.providerNote}</Text>
                </View>
              )}
              {!!order.cancelReason && (
                <View className='kv'>
                  <Text className='kv__k'>取消原因</Text>
                  <Text className='kv__v'>{order.cancelReason}</Text>
                </View>
              )}
              <View className='kv'>
                <Text className='kv__k'>下单时间</Text>
                <Text className='kv__v'>{order.createdAt}</Text>
              </View>
            </View>

            <NoteEditor order={order} onSaved={reload} />

            {!!order.logs && order.logs.length > 0 && (
              <View className='card'>
                <View className='section-head' style={{ margin: '0 0 20rpx' }}>
                  <Text className='section-head__title'>流转记录</Text>
                </View>
                <View className='timeline'>
                  {order.logs.map((log, i) => (
                    <View key={`${log.action}-${i}`} className='timeline__item'>
                      <View className='timeline__rail'>
                        <View className='timeline__dot' />
                        {i < (order.logs?.length || 0) - 1 && <View className='timeline__line' />}
                      </View>
                      <View className='timeline__body'>
                        <View className='timeline__title'>{log.actionLabel}</View>
                        <View className='timeline__time'>
                          {log.createdAt}
                          {log.operatorName ? ` · ${log.operatorName}` : ''}
                        </View>
                        {!!log.remark && <View className='timeline__remark'>{log.remark}</View>}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View className='footer-spacer' />

            <View className='footer-bar'>
              <OrderActions
                order={order}
                acting={acting}
                onConfirm={() => run('confirm', () => confirmOrder(order.id), '已确认')}
                onStart={() => run('start', () => startOrder(order.id), '已开始服务')}
                onComplete={() => setPrompt('complete')}
                onCancel={() => setPrompt('cancel')}
              />
            </View>

            <PromptModal
              visible={prompt === 'cancel'}
              title='取消订单'
              placeholder='请填写取消原因（必填）'
              required
              confirmText='确认取消'
              maxlength={200}
              onCancel={() => setPrompt(null)}
              onConfirm={onSubmitCancel}
            />
            <PromptModal
              visible={prompt === 'complete'}
              title='确认完成服务'
              placeholder='服务备注（选填）'
              confirmText='确认完成'
              maxlength={200}
              onCancel={() => setPrompt(null)}
              onConfirm={onSubmitComplete}
            />
          </View>
        )}
      </PageState>
    </View>
  )
}

/** 状态机允许的下一步操作 */
function OrderActions({
  order,
  acting,
  onConfirm,
  onStart,
  onComplete,
  onCancel
}: {
  order: OrderVO
  acting: string
  onConfirm: () => void
  onStart: () => void
  onComplete: () => void
  onCancel: () => void
}) {
  const terminal = order.status === 'COMPLETED' || order.status === 'CANCELLED'

  if (terminal) {
    return (
      <View className='muted' style={{ textAlign: 'center', padding: '20rpx 0' }}>
        该订单已{order.statusLabel}，没有可执行的操作
      </View>
    )
  }

  return (
    <View className='btn-row'>
      <Button className='btn btn--plain' loading={acting === 'cancel'} disabled={!!acting} onClick={onCancel}>
        取消
      </Button>
      {order.status === 'PENDING_CONFIRM' && (
        <Button className='btn' loading={acting === 'confirm'} disabled={!!acting} onClick={onConfirm}>
          确认接单
        </Button>
      )}
      {order.status === 'CONFIRMED' && (
        <Button className='btn' loading={acting === 'start'} disabled={!!acting} onClick={onStart}>
          开始服务
        </Button>
      )}
      {order.status === 'SERVING' && (
        <Button className='btn' loading={acting === 'complete'} disabled={!!acting} onClick={onComplete}>
          完成服务
        </Button>
      )}
    </View>
  )
}

/** 服务备注：已完成/已取消为终态，仍允许补充备注 */
function NoteEditor({ order, onSaved }: { order: OrderVO; onSaved: () => void }) {
  const [note, setNote] = useState(order.providerNote || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await updateOrderNote(order.id, note.trim())
      Taro.showToast({ title: '备注已保存', icon: 'success' })
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
        <Text className='section-head__title'>服务备注</Text>
      </View>
      <Textarea
        className='form-item__control form-item__control--textarea'
        value={note}
        maxlength={200}
        placeholder='记录服务情况，仅自己可见'
        placeholderClass='form-item__placeholder'
        onInput={(e) => setNote(e.detail.value)}
      />
      <View style={{ marginTop: '16rpx' }}>
        <Button className='btn btn--ghost btn--block' loading={saving} disabled={saving} onClick={save}>
          保存备注
        </Button>
      </View>
    </View>
  )
}