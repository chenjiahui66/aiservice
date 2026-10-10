import { useEffect, useState } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'

interface PromptModalProps {
  visible: boolean
  title: string
  placeholder?: string
  /** 最大长度 */
  maxlength?: number
  /** 是否必填 */
  required?: boolean
  confirmText?: string
  onCancel: () => void
  onConfirm: (value: string) => void
}

/**
 * 轻量输入弹层。
 *
 * 不用 Taro.showModal 的 editable：它在 Taro 类型里没有声明，且跨端不可用。
 * 这里自己实现，各端行为一致、类型完整。
 * 用于「取消原因」「完成备注」这类需要填写短文本的场景。
 */
export default function PromptModal({
  visible,
  title,
  placeholder,
  maxlength = 200,
  required,
  confirmText = '确定',
  onCancel,
  onConfirm
}: PromptModalProps) {
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)

  // 每次打开时清空上一次的输入
  useEffect(() => {
    if (visible) {
      setText('')
      setTouched(false)
    }
  }, [visible])

  if (!visible) return null

  const trimmed = text.trim()
  const showError = touched && required && !trimmed

  const submit = () => {
    setTouched(true)
    if (required && !trimmed) return
    onConfirm(trimmed)
  }

  return (
    <View className='prompt-mask' onClick={onCancel}>
      <View className='prompt' onClick={(e) => e.stopPropagation()}>
        <View className='prompt__title'>{title}</View>
        <Textarea
          className='form-item__control form-item__control--textarea'
          value={text}
          placeholder={placeholder}
          placeholderClass='form-item__placeholder'
          maxlength={maxlength}
          autoHeight
          onInput={(e) => setText(e.detail.value)}
        />
        <View className='row row--between' style={{ marginTop: '10rpx' }}>
          {showError ? (
            <Text className='form-item__error' style={{ marginTop: '0' }}>
              该项为必填
            </Text>
          ) : (
            <Text className='muted'>{maxlength > 0 ? `${text.length}/${maxlength}` : ''}</Text>
          )}
        </View>

        <View className='prompt__actions'>
          <Button className='btn btn--plain' onClick={onCancel}>
            取消
          </Button>
          <Button className='btn' onClick={submit}>
            {confirmText}
          </Button>
        </View>
      </View>
    </View>
  )
}