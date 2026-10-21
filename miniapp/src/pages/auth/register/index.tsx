import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { registerProvider } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { toMessage } from '@/hooks/usePageData'
import ConsentCheckbox from '@/components/ConsentCheckbox'
import { POLICY_VERSION } from '@/constants/policy'

/** 服务者注册：注册后默认「待审核」，需平台审核通过才能对外展示主页 */
export default function RegisterPage() {
  const signIn = useAuthStore((s) => s.signIn)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [realName, setRealName] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [consentAgreed, setConsentAgreed] = useState(false)
  const [consentError, setConsentError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async () => {
    if (submitting) return
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (password.length < 6) {
      Taro.showToast({ title: '密码至少 6 位', icon: 'none' })
      return
    }
    if (password !== confirmPassword) {
      Taro.showToast({ title: '两次输入的密码不一致', icon: 'none' })
      return
    }
    if (!realName.trim()) {
      Taro.showToast({ title: '请填写真实姓名', icon: 'none' })
      return
    }
    // 微信审核要求：收集手机号等个人信息前必须取得明示同意。
    if (!consentAgreed) {
      setConsentError('请先阅读并同意《用户服务协议》和《隐私政策》')
      Taro.showToast({ title: '请先阅读并同意协议与隐私政策', icon: 'none' })
      return
    }
    setConsentError('')

    setSubmitting(true)
    try {
      const res = await registerProvider({
        phone: phone.trim(),
        password,
        realName: realName.trim(),
        serviceArea: serviceArea.trim(),
        consentAgreed: true,
        policyVersion: POLICY_VERSION
      })
      signIn({
        token: res.token,
        providerId: res.providerId,
        displayName: res.displayName,
        username: res.username,
        auditStatus: res.auditStatus,
        auditRemark: res.auditRemark
      })
      Taro.showToast({ title: '注册成功，请等待审核', icon: 'none', duration: 2000 })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/profile/index' })
      }, 1200)
    } catch (e) {
      Taro.showToast({ title: toMessage(e), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='auth'>
      <View className='auth__brand'>注册服务者</View>
      <View className='auth__sub'>注册后需平台审核通过，才能接收客户预约</View>

      <View className='card'>
        <Field
          label='手机号'
          required
          value={phone}
          onChange={setPhone}
          type='number'
          maxlength={11}
          placeholder='请输入手机号'
          hint='手机号仅用于账号登录与就服务事项与你联系，不作其他用途；登录密码以不可逆方式加密存储。'
        />
        <Field label='真实姓名' required value={realName} onChange={setRealName} maxlength={20} placeholder='如：张师傅' />
        <Field label='服务区域' value={serviceArea} onChange={setServiceArea} maxlength={60} placeholder='如：阳光小区' />
        <Field label='密码' required value={password} onChange={setPassword} password placeholder='至少 6 位' />
        <Field label='确认密码' required value={confirmPassword} onChange={setConfirmPassword} password placeholder='再次输入密码' />

        <View style={{ marginTop: '20rpx' }}>
          <ConsentCheckbox
            checked={consentAgreed}
            error={consentError}
            onChange={(v) => {
              setConsentAgreed(v)
              if (v) setConsentError('')
            }}
          />
        </View>

        <View style={{ marginTop: '24rpx' }}>
          <Button
            className='btn btn--block btn--lg'
            loading={submitting}
            disabled={submitting}
            onClick={onSubmit}
          >
            注册
          </Button>
        </View>
      </View>

      <View className='auth__footer'>
        <Text>已有账号？</Text>
        <Text className='link' onClick={() => Taro.navigateBack()}>
          去登录
        </Text>
      </View>
    </View>
  )
}

function Field({
  label,
  value,
  onChange,
  required,
  password,
  type,
  maxlength,
  placeholder,
  hint
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  password?: boolean
  type?: 'text' | 'number'
  maxlength?: number
  placeholder?: string
  /** 字段下方的用途说明（个人信息收集目的的明示告知） */
  hint?: string
}) {
  return (
    <View className='form-item'>
      <View className='form-item__label'>
        {required && <Text className='form-item__required'>*</Text>}
        <Text>{label}</Text>
      </View>
      <Input
        className='form-item__control'
        value={value}
        password={password}
        type={type}
        maxlength={maxlength}
        placeholder={placeholder}
        placeholderClass='form-item__placeholder'
        onInput={(e) => onChange(e.detail.value)}
      />
      {!!hint && (
        <Text className='muted' style={{ display: 'block', marginTop: '8rpx', fontSize: '23rpx' }}>
          {hint}
        </Text>
      )}
    </View>
  )
}