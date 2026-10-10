import type { BookingRules } from '@/types/domain'

/**
 * 日期/时段工具。
 * 预约可选日期区间与时段，完全由服务项目的 bookingRules 决定：
 *   closedDays      休息日（0=周日）
 *   advanceDays     最多可提前多少天
 *   minAdvanceHours 当天至少提前多少小时
 */

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** 本地日期 → YYYY-MM-DD（不使用 toISOString，避免时区偏移串日） */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayStr(): string {
  return toDateStr(new Date())
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map((v) => Number(v))
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

/** 星期几，0=周日 */
export function getWeekday(dateStr: string): number {
  return parseDate(dateStr).getDay()
}

export function weekdayLabel(dateStr: string): string {
  return WEEK_LABELS[getWeekday(dateStr)] || ''
}

/** 月/日 短标签，如 10-12 */
export function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${m}-${d}`
}

export function isClosedDay(dateStr: string, rules: BookingRules): boolean {
  const closed = rules.closedDays
  if (!closed || !closed.length) return false
  return closed.includes(getWeekday(dateStr))
}

/**
 * 可选日期范围 [start, end]。
 * start：若当天已超出 minAdvanceHours 则顺延到明天
 * end：today + advanceDays
 */
export function getBookableRange(rules: BookingRules): { start: string; end: string } {
  const advanceDays = typeof rules.advanceDays === 'number' && rules.advanceDays > 0 ? rules.advanceDays : 7
  const today = todayStr()

  let start = today
  const minAdvanceHours = typeof rules.minAdvanceHours === 'number' ? rules.minAdvanceHours : 0
  if (minAdvanceHours > 0) {
    // 当天所剩可用小时不足以满足最小提前量时，最早只能约明天
    const passedHours = new Date().getHours() + new Date().getMinutes() / 60
    if (passedHours + minAdvanceHours > 23) {
      start = addDays(today, 1)
    }
  }

  return { start, end: addDays(today, advanceDays) }
}

/** 时间段起始小时，如 "09:00-11:00" → 9 */
export function slotStartHour(slot: string): number {
  const m = /^\s*(\d{1,2}):/.exec(slot)
  return m ? Number(m[1]) : 0
}

/**
 * 过滤当前日期下已不可选的时间段（超过 minAdvanceHours）。
 * 非今天则全部可选。
 */
export function filterSlotsForDate(slots: string[], dateStr: string, rules: BookingRules): string[] {
  const minAdvanceHours = typeof rules.minAdvanceHours === 'number' ? rules.minAdvanceHours : 0
  if (minAdvanceHours <= 0 || dateStr !== todayStr()) return slots
  const now = new Date()
  const passedHours = now.getHours() + now.getMinutes() / 60
  return slots.filter((s) => slotStartHour(s) - passedHours >= minAdvanceHours)
}

/** 生成可选日期清单（含星期，休息日会被剔除或标记） */
export function buildDateChoices(
  rules: BookingRules,
  today: string,
  days = 14
): Array<{ value: string; label: string; weekday: string; closed: boolean }> {
  const list: Array<{ value: string; label: string; weekday: string; closed: boolean }> = []
  const maxDay = rules.advanceDays && rules.advanceDays > 0 ? rules.advanceDays : 7
  const total = Math.min(days, Math.max(maxDay, 1))
  for (let i = 0; i < total; i++) {
    const value = addDays(today, i)
    list.push({
      value,
      label: i === 0 ? '今天' : i === 1 ? '明天' : shortDate(value),
      weekday: weekdayLabel(value),
      closed: isClosedDay(value, rules)
    })
  }
  return list
}