import Taro from '@tarojs/taro'
import PolicyViewer from '@/components/PolicyViewer'
import { PRIVACY_POLICY } from '@/constants/policy'

/** 《隐私政策》 */
export default function PrivacyPolicyPage() {
  Taro.useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '隐私政策' })
  })
  return <PolicyViewer doc={PRIVACY_POLICY} />
}
