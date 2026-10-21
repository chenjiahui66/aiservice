import Taro from '@tarojs/taro'
import PolicyViewer from '@/components/PolicyViewer'
import { USER_AGREEMENT } from '@/constants/policy'

/** 《用户服务协议》 */
export default function UserAgreementPage() {
  Taro.useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '用户服务协议' })
  })
  return <PolicyViewer doc={USER_AGREEMENT} />
}
