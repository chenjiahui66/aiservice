import { useState } from 'react'
import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { submitFeedback } from '@/api/feedback'
import { useAuthStore } from '@/store/auth'
import { getQueryParam } from '@/platform'
import { toMessage } from '@/hooks/usePageData'
import ConsentCheckbox from '@/components/ConsentCheckbox'
import { POLICY_VERSION } from '@/constants/policy'
import type { ComplaintType, FeedbackResult } from '@/types/domain'

/** 反馈类型，取值与后端 ComplaintType 枚举严格一致 */
const TYPES: Array<{ value: ComplaintType; label: string; hint: string }> = [
  { value: 'FEEDBACK', label: '功能建议', hint: '功能好不好用、哪里不好用、希望增加什么' },
  { value: 'COMPLAINT', label: '服务投诉', hint: '服务过程中遇到的问题' },
  { value: 'VIOLATION', label: '违规举报', hint: '发现违规行为' }
]

/**
 * 意见反馈（功能意见箱）。
 *
 * 登录的服务者与扫码进来的客户共用这一个页面：
 * - 类型固定为后端枚举的三种，不自造类型，避免管理后台无法归类
 * - 不传 providerId，服务者身份由后端从 token 取，客户身份由 referralCode 反查
 */
export default function FeedbackPage() {
  const displayName = useAuthStore((s) => s.displayName)
  const referralCode = getQueryParam('referralCode')

  const [type, setType] = useState<ComplaintType>('FEEDBACK')
  const [content, setContent] = useState('')
  const [name, setName] = useState(displayName || '')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<FeedbackResult | null>(null)
  const [error, setError] = useState('')
  const [policyAgreed, setPolicyAgreed] = useState(false)
  const [policyError, setPolicyError] = useState('')

  const activeHint = TYPES.find((t) => t.value === type)?.hint || ''

  const onSubmit = async () => {
    if (submitting) return
    const text = content.trim()
    if (!text) {
      setError('请填写反馈内容')
      Taro.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }
    if (text.length > 500) {
      setError('反馈内容最多 500 字')
      return
    }
    if (phone.trim() && !/^1[3-9]\d{9}$/.test(phone.trim())) {
      setError('请输入正确的手机号，便于我们回访')
      return
    }
    // 反馈里可能填写称呼与电话，属于个人信息，提交前必须取得明示同意
    if (!policyAgreed) {
      setPolicyError('请先阅读并同意《隐私政策》')
      Taro.showToast({ title: '请先同意隐私政策', icon: 'none' })
      return
    }
    setPolicyError('')

    setError('')
    setSubmitting(true)
    try {
      const res = await submitFeedback({
        type,
        content: text,
        customerName: name.trim() || undefined,
        customerPhone: phone.trim() || undefined,
        referralCode,
        privacyAccepted: true,
        policyVersion: POLICY_VERSION
      })
      setResult(res)
    } catch (e) {
      // 网络异常与业务失败都落到这里，toMessage 会区分提示
      setError(toMessage(e))
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
            <View className='result__title'>已收到你的反馈</View>
            <View className='result__msg'>
              平台会尽快查看并纳入后续版本迭代，感谢你帮我们把产品做得更好。
            </View>
          </View>
          <View className='divider' />
          <View className='kv'>
            <Text className='kv__k'>反馈编号</Text>
            <Text className='kv__v mono'>{result.id}</Text>
          </View>
          <View className='kv'>
            <Text className='kv__k'>当前状态</Text>
            <Text className='kv__v'>{result.statusLabel || '待处理'}</Text>
          </View>
          <View className='kv'>
            <Text className='kv__k'>提交时间</Text>
            <Text className='kv__v'>{result.createdAt}</Text>
          </View>
        </View>
        <Button className='btn btn--block btn--lg' onClick={() => Taro.navigateBack()}>
          返回
        </Button>
      </View>
    )
  }

  return (
    <View className='page'>
      <View className='notice notice--info' style={{ marginBottom: '20rpx' }}>
        <Text className='notice__icon'>ⓘ</Text>
        <Text>你的每条反馈都会被平台收到，并作为后续版本迭代的输入。</Text>
      </View>

      <View className='card'>
        <View className='form-item'>
          <View className='form-item__label'>
            <Text className='form-item__required'>*</Text>
            <Text>反馈类型</Text>
          </View>
          <View className='chips'>
            {TYPES.map((t) => (
              <View
                key={t.value}
                className={`chip ${type === t.value ? 'chip--on' : ''}`}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </View>
            ))}
          </View>
          <Text className='form-item__hint' style={{ display: 'block', marginTop: '14rpx', marginLeft: '0' }}>
            {activeHint}
          </Text>
        </View>

        <View className='form-item'>
          <View className='form-item__label'>
            <Text className='form-item__required'>*</Text>
            <Text>反馈内容</Text>
            <Text className='form-item__hint'>{`${content.length}/500`}</Text>
          </View>
          <Textarea
            className='form-item__control form-item__control--textarea'
            value={content}
            maxlength={500}
            placeholder='请具体描述你的意见或遇到的问题，例如：希望预约时可以指定上门时间'
            placeholderClass='form-item__placeholder'
            onInput={(e) => setContent(e.detail.value)}
          />
        </View>
      </View>

      <View className='card'>
        <View className='section-head' style={{ margin: '0 0 8rpx' }}>
          <Text className='section-head__title'>联系方式</Text>
          <Text className='muted'>选填</Text>
        </View>
        <Text className='muted' style={{ display: 'block', marginBottom: '20rpx' }}>
          留下联系方式，平台处理时可以直接与你沟通。
        </Text>

        <View className='form-item'>
          <View className='form-item__label'>
            <Text>称呼</Text>
          </View>
          <Input
            className='form-item__control'
            value={name}
            maxlength={20}
            placeholder='怎么称呼你'
            placeholderClass='form-item__placeholder'
            onInput={(e) => setName(e.detail.value)}
          />
        </View>

        <View className='form-item'>
          <View className='form-item__label'>
            <Text>手机号</Text>
          </View>
          <Input
            className='form-item__control'
            type='number'
            value={phone}
            maxlength={11}
            placeholder='便于回访'
            placeholderClass='form-item__placeholder'
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>
      </View>

      {!!error && (
        <View className='notice notice--danger' style={{ marginBottom: '20rpx' }}>
          <Text className='notice__icon'>⚠</Text>
          <Text>{error}</Text>
        </View>
      )}

      <View style={{ marginBottom: '20rpx' }}>
        <ConsentCheckbox
          checked={policyAgreed}
          error={policyError}
          note='你填写的称呼与手机号仅用于处理本条反馈时与你联系，不会用于其他用途。'
          onChange={(v) => {
            setPolicyAgreed(v)
            if (v) setPolicyError('')
          }}
        />
      </View>

      <Button
        className='btn btn--block btn--lg'
        loading={submitting}
        disabled={submitting}
        onClick={onSubmit}
      >
        提交反馈
      </Button>
      <View className='footer-spacer' />
    </View>
  )
}