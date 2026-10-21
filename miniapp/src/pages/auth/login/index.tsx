import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { loginProvider } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { toMessage } from '@/hooks/usePageData'
import ConsentCheckbox from '@/components/ConsentCheckbox'
import { POLICY_VERSION } from '@/constants/policy'

/** 服务者登录 */
export default function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [consentAgreed, setConsentAgreed] = useState(false)
  const [consentError, setConsentError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async () => {
    if (submitting) return
    if (!username.trim() || !password) {
      Taro.showToast({ title: '请输入手机号和密码', icon: 'none' })
      return
    }
    // 微信审核要求：收集手机号等个人信息前必须取得明示同意。
    // 不勾选就不发请求 —— 后端也会拒，但前端拦一层能少一次无谓往返。
    if (!consentAgreed) {
      setConsentError('请先阅读并同意《用户服务协议》和《隐私政策》')
      Taro.showToast({ title: '请先阅读并同意协议与隐私政策', icon: 'none' })
      return
    }
    setConsentError('')
    setSubmitting(true)
    try {
      const res = await loginProvider({
        username: username.trim(),
        password,
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
          {/* 手机号用途明示告知：审核要求「明确告知收集用户信息的使用目的、方式和用途」 */}
          <Text className='muted' style={{ display: 'block', marginTop: '8rpx', fontSize: '23rpx' }}>
            手机号仅用于账号登录与就服务事项与你联系，不作其他用途；登录密码以不可逆方式加密存储。
          </Text>
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
            登录
          </Button>
        </View>
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