import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

interface Props {
  /** 是否已勾选 */
  checked: boolean
  /** 勾选状态变化 */
  onChange: (v: boolean) => void
  /** 校验错误文案 */
  error?: string
  /** 勾选框下方的补充说明（如手机号用途告知） */
  note?: string
}

/**
 * 《用户服务协议》+《隐私政策》同意勾选框。
 *
 * 微信审核硬性要求：收集手机号等个人信息前必须明示告知并取得用户授权同意。
 * 这个组件是同意动作的入口，真正的留证在后端（user_consents 表）。
 *
 * ⚠️ 协议链接放在勾选框**外面**的一行，不嵌在勾选文案里：
 *    小程序事件是冒泡的，链接若在 checkline 内部，点它会连带触发勾选切换；
 *    而 Taro 的组件类型没有暴露 onCatch*，没法用 catch 阻止冒泡。
 *    挪出来之后链接可点、勾选区独立，两边都不会互相干扰。
 */
export default function ConsentCheckbox({ checked, onChange, error, note }: Props) {
  return (
    <View>
      <View className='policy-links'>
        <Text
          className='link'
          onClick={() => Taro.navigateTo({ url: '/pages/legal/terms/index' })}
        >
          《用户服务协议》
        </Text>
        <Text className='muted'>和</Text>
        <Text
          className='link'
          onClick={() => Taro.navigateTo({ url: '/pages/legal/privacy/index' })}
        >
          《隐私政策》
        </Text>
      </View>

      <View className='checkline' onClick={() => onChange(!checked)}>
        <View className={`checkbox ${checked ? 'checkbox--on' : ''}`}>✓</View>
        <View className='grow'>
          <Text>我已阅读并同意《用户服务协议》和《隐私政策》</Text>

          {!!note && (
            <Text className='muted' style={{ display: 'block', marginTop: '8rpx' }}>
              {note}
            </Text>
          )}
          {!!error && (
            <Text className='form-item__error' style={{ display: 'block' }}>
              {error}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}
