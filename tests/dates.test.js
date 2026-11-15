import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, calculateStreak, localDateStr, mondayOf, weekDates } from '../src/lib/dates.js'

// The bug these guard against only shows west of UTC in the evening, so pin
// the zone the app is actually used in. Run via `npm test`, which sets TZ.
test('runs in US Eastern', () => {
  assert.equal(process.env.TZ, 'America/New_York')
})

test('an evening in Eastern is still today, not the UTC date', () => {
  const evening = new Date('2026-11-16T01:30:00Z') // 8:30pm Sunday Nov 15 in Maine
  assert.equal(evening.toISOString().split('T')[0], '2026-11-16')
  assert.equal(localDateStr(evening), '2026-11-15')
})

test('weeks run Monday to Sunday, and Sunday belongs to the week ending on it', () => {
  assert.equal(mondayOf('2026-11-15'), '2026-11-09') // a Sunday
  assert.equal(mondayOf('2026-11-16'), '2026-11-16') // a Monday
  assert.equal(mondayOf('2026-11-18'), '2026-11-16')
})

test('the week strip contains today at any hour, including Sunday night', () => {
  const sundayNight = new Date('2026-11-16T03:00:00Z') // 10pm Sunday Nov 15
  const week = weekDates(0, sundayNight)
  assert.deepEqual(week, [
    '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
  ])
  assert.equal(weekDates(1, sundayNight)[0], '2026-11-16')
  assert.equal(weekDates(-1, sundayNight)[6], '2026-11-08')
})

test('addDays crosses months and the daylight-saving change', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-11-01', 1), '2026-11-02') // clocks go back Nov 1
  assert.equal(addDays('2026-03-08', 1), '2026-03-09') // clocks go forward Mar 8
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
})

test('streak counts consecutive days ending today or yesterday', () => {
  const today = localDateStr()
  const d = (n) => addDays(today, -n)
  assert.equal(calculateStreak([]), 0)
  assert.equal(calculateStreak([today]), 1)
  assert.equal(calculateStreak([d(1), d(2), d(3)]), 3)
  assert.equal(calculateStreak([today, d(1), d(1), d(3)]), 2)
  assert.equal(calculateStreak([d(2), d(3)]), 0)
})
