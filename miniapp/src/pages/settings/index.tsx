import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuthStore } from '@/store/auth'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { isWeapp } from '@/platform'
import { BASE_URL } from '@/utils/request'
import { redirectToLogin } from '@/utils/auth-redirect'

/** 我的账号与设置 */
export default function SettingsPage() {
  useAuthGuard()
  const displayName = useAuthStore((s) => s.displayName)
  const username = useAuthStore((s) => s.username)
  const providerId = useAuthStore((s) => s.providerId)
  const signOut = useAuthStore((s) => s.signOut)

  const onSignOut = () => {
    Taro.showModal({
      title: '退出登录',
      content: '退出后需要重新登录才能查看订单和客户。',
      confirmColor: '#C53030',
      success: (res) => {
        if (!res.confirm) return
        signOut()
        // 走统一入口：signOut 会把 token 清空，useAuthGuard 也会触发跳转，
        // 两边都跳的话登录页会被压两次。
        redirectToLogin({ toast: null })
      }
    })
  }

  const onClearCache = () => {
    Taro.showModal({
      title: '清理缓存',
      content: '仅清理本小程序本地缓存，不会删除服务器上的任何数据。',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const info = Taro.getStorageInfoSync()
          Taro.showToast({
            title: `本地缓存约 ${Math.ceil((info.currentSize || 0) / 1024)}KB`,
            icon: 'none'
          })
        } catch {
          Taro.showToast({ title: '清理失败', icon: 'none' })
        }
      }
    })
  }

  return (
    <View className='page'>
      <View className='card'>
        <View className='row'>
          <View className='grow'>
            <View className='title'>{displayName || '服务者'}</View>
            <View className='muted' style={{ marginTop: '6rpx' }}>
              {username}
            </View>
          </View>
          <Text className='tag'>ID {providerId ?? '-'}</Text>
        </View>
      </View>

      <View className='setting-group'>
        <View
          className='setting-item'
          onClick={() => Taro.navigateTo({ url: '/pages/profile/index' })}
        >
          <Text>服务者资料</Text>
          <Text className='setting-item__value'>审核状态与资料 ›</Text>
        </View>
        <View
          className='setting-item'
          onClick={() => Taro.navigateTo({ url: '/pages/page-edit/index' })}
        >
          <Text>服务主页配置</Text>
          <Text className='setting-item__value'>编辑主页内容 ›</Text>
        </View>
        <View
          className='setting-item'
          onClick={() => Taro.navigateTo({ url: '/pages/service-items/index' })}
        >
          <Text>我的服务类目</Text>
          <Text className='setting-item__value'>选择我提供哪几项 ›</Text>
        </View>
        <View
          className='setting-item'
          onClick={() => Taro.switchTab({ url: '/pages/referral/index' })}
        >
          <Text>我的推广</Text>
          <Text className='setting-item__value'>推广码与统计 ›</Text>
        </View>
        <View
          className='setting-item'
          onClick={() => Taro.navigateTo({ url: '/pages/feedback/index' })}
        >
          <Text>意见反馈</Text>
          <Text className='setting-item__value'>功能建议与问题反馈 ›</Text>
        </View>
        <View
          className='setting-item'
          onClick={() => Taro.navigateTo({ url: '/pages/legal/terms/index' })}
        >
          <Text>用户服务协议</Text>
          <Text className='setting-item__value'>查看 ›</Text>
        </View>
        <View
          className='setting-item'
          onClick={() => Taro.navigateTo({ url: '/pages/legal/privacy/index' })}
        >
          <Text>隐私政策</Text>
          <Text className='setting-item__value'>查看 ›</Text>
        </View>
      </View>

      <View className='setting-group'>
        <View className='setting-item'>
          <Text>运行环境</Text>
          <Text className='setting-item__value'>{isWeapp() ? '微信小程序' : '非微信环境（能力受限）'}</Text>
        </View>
        <View className='setting-item' onClick={onClearCache}>
          <Text>本地缓存</Text>
          <Text className='setting-item__value'>查看占用 ›</Text>
        </View>
      </View>

      <View style={{ marginTop: '40rpx' }}>
        <Button className='btn btn--danger-ghost btn--block' onClick={onSignOut}>
          退出登录
        </Button>
      </View>
    </View>
  )
}