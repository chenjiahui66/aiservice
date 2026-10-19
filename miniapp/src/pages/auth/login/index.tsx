import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { loginProvider } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { toMessage } from '@/hooks/usePageData'

/** 服务者登录 */
export default function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async () => {
    if (submitting) return
    if (!username.trim() || !password) {
      Taro.showToast({ title: '请输入手机号和密码', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const res = await loginProvider({ username: username.trim(), password })
      signIn({
        token: res.token,
        providerId: res.providerId,
        displayName: res.displayName,
        username: res.username,
        auditStatus: res.auditStatus,
        auditRemark: res.auditRemark
      })
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        // 登录页是 navigateTo 进来的，逐层返回到台账
        Taro.switchTab({ url: '/pages/board/index' })
      }, 600)
    } catch (e) {
      Taro.showToast({ title: toMessage(e), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='auth'>
      <View className='auth__brand'>邻小来</View>
      <View className='auth__sub'>服务者登录 · 管理你的预约与客户</View>

      <View className='card'>
        <View className='form-item'>
          <View className='form-item__label'>
            <Text className='form-item__required'>*</Text>
            <Text>手机号</Text>
          </View>
          <Input
            className='form-item__control'
            type='number'
            maxlength={11}
            value={username}
            placeholder='请输入注册手机号'
            placeholderClass='form-item__placeholder'
            onInput={(e) => setUsername(e.detail.value)}
          />
        </View>

        <View className='form-item'>
          <View className='form-item__label'>
            <Text className='form-item__required'>*</Text>
            <Text>密码</Text>
          </View>
          <Input
            className='form-item__control'
            password
            value={password}
            placeholder='请输入密码'
            placeholderClass='form-item__placeholder'
            onInput={(e) => setPassword(e.detail.value)}
            onConfirm={onSubmit}
          />
        </View>

        <Button
          className='btn btn--block btn--lg'
          loading={submitting}
          disabled={submitting}
          onClick={onSubmit}
        >
          登录
        </Button>
      </View>

      <View className='auth__footer'>
        <Text>还没有账号？</Text>
        <Text
          className='link'
          onClick={() => Taro.navigateTo({ url: '/pages/auth/register/index' })}
        >
          立即注册
        </Text>
      </View>
    </View>
  )
}