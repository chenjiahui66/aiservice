import type { BookingRules, FormFieldConfig, FormFieldType } from '@/types/domain'

/**
 * 服务项目表单配置解析。
 *
 * 背景：后端 ServiceItem.formFields / bookingRules 以 **JSON 字符串** 下发，
 * 由服务者/平台在后台配置，前端必须 JSON.parse 后按配置动态渲染，
 * 绝不把某个具体服务项目（如「代扔垃圾」）的字段写死在页面里。
 *
 * 解析必须容错：配置写坏时返回空配置，页面降级为「该服务项目未配置表单」，
 * 而不是整页白屏。
 */

const VALID_TYPES: FormFieldType[] = [
  'text',
  'phone',
  'textarea',
  'number',
  'date',
  'slot',
  'serviceItem',
  'select'
]

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** 解析 formFields JSON 字符串 → 表单项配置数组 */
export function parseFormFields(raw: string | null | undefined): FormFieldConfig[] {
  if (!raw || typeof raw !== 'string') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // 配置非法：返回空数组，页面会提示未配置表单
    return []
  }
  if (!Array.isArray(parsed)) return []

  const fields: FormFieldConfig[] = []
  for (const item of parsed) {
    if (!isPlainObject(item)) continue
    const key = typeof item.key === 'string' ? item.key : ''
    if (!key) continue
    const type = VALID_TYPES.includes(item.type as FormFieldType)
      ? (item.type as FormFieldType)
      : 'text'
    fields.push({
      key,
      type,
      label: typeof item.label === 'string' && item.label ? item.label : key,
      required: item.required === true,
      maxLength: typeof item.maxLength === 'number' ? item.maxLength : undefined,
      placeholder: typeof item.placeholder === 'string' ? item.placeholder : undefined,
      min: typeof item.min === 'number' ? item.min : undefined,
      max: typeof item.max === 'number' ? item.max : undefined,
      options: normalizeOptions(item.options)
    })
  }
  return fields
}

function normalizeOptions(raw: unknown): FormFieldConfig['options'] {
  if (!Array.isArray(raw)) return undefined
  const opts: Array<{ label: string; value: string | number }> = []
  for (const o of raw) {
    if (typeof o === 'string' || typeof o === 'number') {
      opts.push({ label: String(o), value: o })
    } else if (isPlainObject(o) && 'value' in o) {
      const value = o.value
      if (typeof value === 'string' || typeof value === 'number') {
        opts.push({
          value,
          label: typeof o.label === 'string' ? o.label : String(value)
        })
      }
    }
  }
  return opts.length ? opts : undefined
}

/** 解析 bookingRules JSON 字符串 → 预约规则 */
export function parseBookingRules(raw: string | null | undefined): BookingRules {
  if (!raw || typeof raw !== 'string') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!isPlainObject(parsed)) return {}

  const rules: BookingRules = {}
  if (Array.isArray(parsed.slots)) {
    rules.slots = parsed.slots.filter((s): s is string => typeof s === 'string' && !!s)
  }
  if (Array.isArray(parsed.closedDays)) {
    rules.closedDays = parsed.closedDays.filter((d): d is number => typeof d === 'number')
  }
  if (typeof parsed.advanceDays === 'number') rules.advanceDays = parsed.advanceDays
  if (typeof parsed.minAdvanceHours === 'number') rules.minAdvanceHours = parsed.minAdvanceHours
  return rules
}

/** 表单初始值：按配置生成，number 默认取 min，slot 默认空 */
export function buildInitialValues(
  fields: FormFieldConfig[]
): Record<string, string | number> {
  const values: Record<string, string | number> = {}
  for (const f of fields) {
    if (f.type === 'number') {
      values[f.key] = f.min ?? 1
    } else {
      values[f.key] = ''
    }
  }
  return values
}

export interface ValidationResult {
  valid: boolean
  /** key -> 错误文案 */
  errors: Record<string, string>
}

/**
 * 按配置校验表单。
 * required / maxLength / 数字 min-max，全部来自后端配置，不写死业务规则。
 */
export function validateValues(
  fields: FormFieldConfig[],
  values: Record<string, string | number>
): ValidationResult {
  const errors: Record<string, string> = {}
  for (const f of fields) {
    const raw = values[f.key]
    const text = raw === undefined || raw === null ? '' : String(raw).trim()

    if (f.required && !text) {
      errors[f.key] = `请填写${f.label}`
      continue
    }
    if (!text) continue

    if (f.maxLength && text.length > f.maxLength) {
      errors[f.key] = `${f.label}最多 ${f.maxLength} 个字符`
      continue
    }
    if (f.type === 'phone' && !/^1[3-9]\d{9}$/.test(text)) {
      errors[f.key] = '请输入正确的手机号'
      continue
    }
    if (f.type === 'number') {
      const n = Number(text)
      if (Number.isNaN(n)) {
        errors[f.key] = `请输入有效的${f.label}`
        continue
      }
      if (f.min !== undefined && n < f.min) {
        errors[f.key] = `${f.label}不能小于 ${f.min}`
        continue
      }
      if (f.max !== undefined && n > f.max) {
        errors[f.key] = `${f.label}不能大于 ${f.max}`
        continue
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors }
}