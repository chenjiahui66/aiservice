import { Input, Textarea, ScrollView, View, Text } from '@tarojs/components'
import type { BookingRules, FormFieldConfig, ServiceItem } from '@/types/domain'
import {
  buildDateChoices,
  filterSlotsForDate,
  getBookableRange,
  todayStr
} from '@/utils/date'

interface FormFieldProps {
  field: FormFieldConfig
  value: string | number
  error?: string
  /** 当前表单全部值：slot 类型需要依据已选日期过滤可选时段 */
  values: Record<string, string | number>
  bookingRules: BookingRules
  /** serviceItem 类型需要的服务项目清单 */
  serviceItems: ServiceItem[]
  onChange: (key: string, value: string | number) => void
}

/**
 * 按后端 formFields 配置动态渲染单个表单项。
 *
 * ⚠️ 这里刻意不出现任何具体业务字段（如「代扔垃圾」相关字段）。
 * 字段的类型、标签、必填、长度、数值范围、占位符全部来自后端配置，
 * 新增服务项目无需改前端代码。
 */
export default function FormField({
  field,
  value,
  error,
  values,
  bookingRules,
  serviceItems,
  onChange
}: FormFieldProps) {
  const { key, type, label, required, maxLength, placeholder, min, max, options } = field
  const textValue = value === undefined || value === null ? '' : String(value)
  const errorClass = error ? 'form-item__control--error' : ''

  const renderControl = () => {
    switch (type) {
      case 'textarea':
        return (
          <Textarea
            className={`form-item__control form-item__control--textarea ${errorClass}`}
            value={textValue}
            placeholder={placeholder || `请输入${label}`}
            maxlength={maxLength || -1}
            autoHeight
            onInput={(e) => onChange(key, e.detail.value)}
          />
        )

      case 'phone':
        return (
          <Input
            className={`form-item__control ${errorClass}`}
            type='number'
            value={textValue}
            placeholder={placeholder || `请输入${label}`}
            maxlength={maxLength || 11}
            onInput={(e) => onChange(key, e.detail.value)}
          />
        )

      case 'number':
        return (
          <View className='stepper'>
            <View
              className={`stepper__btn ${Number(textValue) <= (min ?? 1) ? 'stepper__btn--off' : ''}`}
              onClick={() => {
                const cur = Number(textValue) || (min ?? 1)
                if (cur <= (min ?? 1)) return
                onChange(key, cur - 1)
              }}
            >
              −
            </View>
            <Text className='stepper__value'>{textValue || (min ?? 1)}</Text>
            <View
              className={`stepper__btn ${
                max !== undefined && Number(textValue) >= max ? 'stepper__btn--off' : ''
              }`}
              onClick={() => {
                const cur = Number(textValue) || (min ?? 1)
                if (max !== undefined && cur >= max) return
                onChange(key, cur + 1)
              }}
            >
              +
            </View>
          </View>
        )

      case 'date':
        return <DateControl rules={bookingRules} value={textValue} onChange={(v) => onChange(key, v)} />

      case 'slot':
        return (
          <SlotControl
            rules={bookingRules}
            values={values}
            value={textValue}
            onChange={(v) => onChange(key, v)}
          />
        )

      case 'serviceItem':
        return (
          <View className='chips'>
            {serviceItems.map((item) => {
              const on = textValue === String(item.id)
              return (
                <View
                  key={item.id}
                  className={`chip ${on ? 'chip--on' : ''}`}
                  onClick={() => onChange(key, item.id)}
                >
                  {item.name}
                </View>
              )
            })}
          </View>
        )

      case 'select':
        return (
          <View className='chips'>
            {(options || []).map((opt) => {
              const on = textValue === String(opt.value)
              return (
                <View
                  key={String(opt.value)}
                  className={`chip ${on ? 'chip--on' : ''}`}
                  onClick={() => onChange(key, opt.value)}
                >
                  {opt.label}
                </View>
              )
            })}
          </View>
        )

      case 'text':
      default:
        return (
          <Input
            className={`form-item__control ${errorClass}`}
            value={textValue}
            placeholder={placeholder || `请输入${label}`}
            maxlength={maxLength || 140}
            onInput={(e) => onChange(key, e.detail.value)}
          />
        )
    }
  }

  return (
    <View className='form-item'>
      <View className='form-item__label'>
        {required && <Text className='form-item__required'>*</Text>}
        <Text>{label}</Text>
        {!!maxLength && type !== 'number' && (
          <Text className='form-item__hint'>{`${textValue.length}/${maxLength}`}</Text>
        )}
      </View>
      {renderControl()}
      {!!error && <Text className='form-item__error'>{error}</Text>}
    </View>
  )
}

/** 日期：按 bookingRules 的 advanceDays / closedDays 约束的可选日期条 */
function DateControl({
  rules,
  value,
  onChange
}: {
  rules: BookingRules
  value: string
  onChange: (v: string) => void
}) {
  const today = todayStr()
  const { start, end } = getBookableRange(rules)
  const choices = buildDateChoices(rules, today).filter((c) => c.value >= start && c.value <= end)

  if (!choices.length) {
    return (
      <View className='form-item__control'>
        <Text className='form-item__placeholder'>当前没有可预约的日期，请稍后再来</Text>
      </View>
    )
  }

  const selected = choices.find((c) => c.value === value)

  return (
    <View>
      <ScrollView className='date-scroll' scrollX enableFlex>
        <View style={{ display: 'inline-flex', paddingBottom: '4rpx' }}>
          {choices.map((c) => {
            const on = c.value === value
            const cls = `date-chip ${on ? 'date-chip--on' : ''} ${c.closed ? 'date-chip--closed' : ''}`
            return (
              <View
                key={c.value}
                className={cls}
                onClick={() => {
                  if (c.closed) return
                  onChange(c.value)
                }}
              >
                <Text className='date-chip__label'>{c.closed ? '休息' : c.label}</Text>
                <Text className='date-chip__week'>{c.closed ? '不接单' : c.weekday}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
      {!selected && (
        <Text className='form-item__hint' style={{ display: 'block', marginTop: '10rpx', marginLeft: '0' }}>
          可预约范围：{start} 至 {end}
        </Text>
      )}
    </View>
  )
}

/** 时段：来自 bookingRules.slots，并按已选日期 + minAdvanceHours 过滤 */
function SlotControl({
  rules,
  values,
  value,
  onChange
}: {
  rules: BookingRules
  values: Record<string, string | number>
  value: string
  onChange: (v: string) => void
}) {
  const allSlots = rules.slots || []
  const bookingDate = String(values.bookingDate || '')
  const available = bookingDate ? filterSlotsForDate(allSlots, bookingDate, rules) : allSlots

  if (!allSlots.length) {
    return (
      <View className='form-item__control'>
        <Text className='form-item__placeholder'>该服务未配置可预约时段</Text>
      </View>
    )
  }

  return (
    <View>
      <View className='chips'>
        {allSlots.map((slot) => {
          const disabled = !available.includes(slot)
          const on = value === slot
          return (
            <View
              key={slot}
              className={`chip ${on ? 'chip--on' : ''} ${disabled && !on ? 'chip--off' : ''}`}
              onClick={() => {
                if (disabled) return
                onChange(slot)
              }}
            >
              {slot}
            </View>
          )
        })}
      </View>
      {!!bookingDate && available.length === 0 && (
        <Text className='form-item__hint' style={{ display: 'block', marginTop: '10rpx', marginLeft: '0' }}>
          所选日期已无可约时段，请换一天
        </Text>
      )}
    </View>
  )
}