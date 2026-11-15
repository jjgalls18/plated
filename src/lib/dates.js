/**
 * Calendar dates in the phone's own timezone.
 *
 * `new Date().toISOString().split('T')[0]` is the UTC date, which in US Eastern
 * rolls over to tomorrow at 7pm (8pm in summer) — right at dinner time. That
 * made "tonight's dinner" show tomorrow's plan, shifted the week strip by a day
 * and filed an evening cook under the next day. Everything that means "which
 * day is it for the person holding the phone" goes through here instead.
 */

/** 'YYYY-MM-DD' for a Date (or anything `new Date()` accepts), in local time. */
export function localDateStr(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** A 'YYYY-MM-DD' string as a Date at local midnight. */
export function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 'YYYY-MM-DD' shifted by a number of days. */
export function addDays(dateStr, days) {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

/**
 * The Monday of the week containing `value`. Weeks run Monday to Sunday,
 * matching meal_plans (week_start is a Monday, day_of_week 0=Mon..6=Sun), so a
 * Sunday belongs to the week that started six days earlier, not the next one.
 */
export function mondayOf(value = new Date()) {
  const d = typeof value === 'string' ? parseLocalDate(value) : new Date(value)
  const jsDay = d.getDay() // 0=Sun..6=Sat
  d.setDate(d.getDate() - (jsDay === 0 ? 6 : jsDay - 1))
  return localDateStr(d)
}

/** The seven dates (Mon..Sun) of the week `offset` weeks from the current one. */
export function weekDates(offset = 0, now = new Date()) {
  const monday = addDays(mondayOf(now), offset * 7)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/**
 * Consecutive days cooked, counting back from today — or from yesterday, so a
 * streak isn't shown as broken before tonight's dinner has been made.
 */
export function calculateStreak(cookedDates = []) {
  if (cookedDates.length === 0) return 0
  const unique = [...new Set(cookedDates)].sort().reverse()
  const today = localDateStr()
  if (unique[0] !== today && unique[0] !== addDays(today, -1)) return 0
  let count = 1
  for (let i = 1; i < unique.length; i++) {
    if (unique[i] === addDays(unique[i - 1], -1)) count++
    else break
  }
  return count
}
