import Taro from '@tarojs/taro'
import PolicyViewer from '@/components/PolicyViewer'
import { PRIVACY_POLICY } from '@/constants/policy'
import { usePageShare } from '@/hooks/usePageShare'

/** 《隐私政策》 */
export default function PrivacyPolicyPage() {
  usePageShare()
  Taro.useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '隐私政策' })
  })
  return <PolicyViewer doc={PRIVACY_POLICY} />
}
