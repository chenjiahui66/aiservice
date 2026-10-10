import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { registerProvider } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { toMessage } from '@/hooks/usePageData'

/** 服务者注册：注册后默认「待审核」，需平台审核通过才能对外展示主页 */
export default function RegisterPage() {
  const signIn = useAuthStore((s) => s.signIn)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [realName, setRealName] = useState('')
  const [serviceArea, setServiceArea] = useState('')
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

    setSubmitting(true)
    try {
      const res = await registerProvider({
        phone: phone.trim(),
        password,
        realName: realName.trim(),
        serviceArea: serviceArea.trim()
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
        <Field label='手机号' required value={phone} onChange={setPhone} type='number' maxlength={11} placeholder='请输入手机号' />
        <Field label='真实姓名' required value={realName} onChange={setRealName} maxlength={20} placeholder='如：张师傅' />
        <Field label='服务区域' value={serviceArea} onChange={setServiceArea} maxlength={60} placeholder='如：阳光小区' />
        <Field label='密码' required value={password} onChange={setPassword} password placeholder='至少 6 位' />
        <Field label='确认密码' required value={confirmPassword} onChange={setConfirmPassword} password placeholder='再次输入密码' />

        <Button
          className='btn btn--block btn--lg'
          loading={submitting}
          disabled={submitting}
          onClick={onSubmit}
        >
          注册
        </Button>
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
  placeholder
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  password?: boolean
  type?: 'text' | 'number'
  maxlength?: number
  placeholder?: string
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
    </View>
  )
}