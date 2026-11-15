/**
 * Pure helpers for the recipe page and Cooking Mode. Nothing here touches the
 * DOM, so tests/ can run it under plain Node.
 */

const UNICODE_FRACTIONS = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
  '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
}

// One quantity: "2", "0.5", "1/2", or a mixed number "1 1/2".
const QUANTITY = String.raw`(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+)|\/(\d+(?:\.\d+)?))?`
const AMOUNT_RE = new RegExp(String.raw`^${QUANTITY}(?:\s*[-–]\s*${QUANTITY})?`)

function quantityValue(n, mixedNum, mixedDen, den) {
  if (mixedNum) return parseFloat(n) + parseFloat(mixedNum) / parseFloat(mixedDen)
  if (den) return parseFloat(n) / parseFloat(den)
  return parseFloat(n)
}

// The fractions a measuring set actually has. 1.5 reads better as "1 1/2",
// and 0.33 cups is not something anyone can measure.
const KITCHEN_FRACTIONS = [
  [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [3 / 8, '3/8'], [1 / 2, '1/2'],
  [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'], [7 / 8, '7/8'],
]

function formatQuantity(value) {
  const whole = Math.floor(value + 1e-9)
  const part = value - whole
  if (part < 0.02) return String(whole)
  const match = KITCHEN_FRACTIONS.find(([f]) => Math.abs(f - part) < 0.02)
  if (match) return whole ? `${whole} ${match[1]}` : match[1]
  return String(Math.round(value * 100) / 100)
}

/**
 * Scales the leading quantity of an ingredient amount and keeps whatever unit
 * or text follows ("cups"). Understands plain numbers, fractions ("1/2", "½"),
 * mixed numbers ("1 1/2" — which used to be read as just "1", so doubling
 * "1 1/2 cups" gave "2 1/2 cups") and ranges ("1-2"). Amounts with no leading
 * number ("pinch") come back untouched.
 */
export function scaleAmount(amount, scale = 1) {
  if (!amount || scale === 1) return amount
  // "1½ cups" → "1 1/2 cups", "½ cup" → "1/2 cup"
  const text = String(amount)
    .replace(/(\d)([½⅓⅔¼¾⅛⅜⅝⅞])/g, '$1 $2')
    .replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, (ch) => UNICODE_FRACTIONS[ch])

  const match = text.match(AMOUNT_RE)
  if (!match) return amount

  const [full, n1, mn1, md1, d1, n2, mn2, md2, d2] = match
  const rest = text.slice(full.length)
  // "200g" keeps its unit tight; "2 cups" keeps its space — both are in rest.
  const first = formatQuantity(quantityValue(n1, mn1, md1, d1) * scale)
  if (!n2) return `${first}${rest}`
  return `${first}-${formatQuantity(quantityValue(n2, mn2, md2, d2) * scale)}${rest}`
}

const UNIT_SECONDS = { h: 3600, m: 60, s: 1 }

// "8 minutes", "1 1/2 hours", "10-12 min", "30 to 45 seconds", "1 hour 15 minutes"
const NUMBER = String.raw`(\d+(?:\.\d+)?(?:\s+\d\/\d)?|\d\/\d)`
const UNIT = String.raw`(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b`
const TIME_RE = new RegExp(
  String.raw`${NUMBER}(?:\s*(?:-|–|—|to|or)\s*${NUMBER})?\s*-?\s*${UNIT}(?:\s*(?:and\s+)?${NUMBER}\s*-?\s*${UNIT})?`,
  'gi'
)

function toNumber(text) {
  // "1 1/2" → 1.5, "1/2" → 0.5, "8" → 8
  return text.trim().split(/\s+/).reduce((sum, part) => {
    const [n, d] = part.split('/')
    return sum + (d ? parseFloat(n) / parseFloat(d) : parseFloat(n))
  }, 0)
}

const unitKey = (unit) => unit[0].toLowerCase()

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts = []
  if (h) parts.push(`${h} hr`)
  if (m) parts.push(`${m} min`)
  if (s && !h) parts.push(`${s} sec`)
  return parts.join(' ') || '0 sec'
}

/**
 * Finds the cooking times a step mentions, so Cooking Mode can offer them as
 * one-tap timers instead of making someone with wet hands type "8".
 *
 * A range ("10-12 minutes") starts at its lower bound — that is when to go
 * and look at the pan. Returns [{ seconds, label }], de-duplicated, at most
 * three, in the order they appear.
 */
export function findStepTimes(text) {
  if (!text) return []
  const found = []
  for (const match of String(text).matchAll(TIME_RE)) {
    const [, first, , unit, extra, extraUnit] = match
    let seconds = toNumber(first) * UNIT_SECONDS[unitKey(unit)]
    // "1 hour 15 minutes" — only when the second part is a smaller unit.
    if (extra && extraUnit && UNIT_SECONDS[unitKey(extraUnit)] < UNIT_SECONDS[unitKey(unit)]) {
      seconds += toNumber(extra) * UNIT_SECONDS[unitKey(extraUnit)]
    }
    seconds = Math.round(seconds)
    // Under 10 seconds isn't worth a timer; over 12 hours is a marinade.
    if (seconds < 10 || seconds > 12 * 3600) continue
    if (found.some((t) => t.seconds === seconds)) continue
    found.push({ seconds, label: formatDuration(seconds) })
    if (found.length === 3) break
  }
  return found
}
