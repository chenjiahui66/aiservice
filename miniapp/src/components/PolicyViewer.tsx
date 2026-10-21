import { View, Text } from '@tarojs/components'
import type { PolicyDoc } from '@/constants/policy'

/**
 * 协议正文渲染器。
 *
 * 用户服务协议与隐私政策共用同一套排版，只是内容不同。
 */
export default function PolicyViewer({ doc }: { doc: PolicyDoc }) {
  return (
    <View className='page'>
      <View className='card'>
        <View className='title'>{doc.title}</View>
        <Text className='muted' style={{ display: 'block', marginTop: '8rpx' }}>
          {doc.subtitle}
        </Text>
      </View>

      {doc.sections.map((section, i) => (
        <View className='card' key={`${section.title}-${i}`}>
          <View className='section-head__title'>{section.title}</View>

          {section.paragraphs?.map((p, j) => (
            <Text className='policy__p' key={`p-${j}`}>
              {p}
            </Text>
          ))}

          {section.list?.map((item, j) => (
            <View className='policy__li' key={`l-${j}`}>
              <Text className='policy__bullet'>·</Text>
              <Text className='grow'>{item}</Text>
            </View>
          ))}
        </View>
      ))}

      <View className='footer-spacer' />
    </View>
  )
}
