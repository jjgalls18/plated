import { supabaseAdmin } from '../_supabaseAdmin.js'

/**
 * Public (secret-token-gated) ICS feed for Apple Calendar to subscribe to.
 * Apple Calendar polls this with no auth headers at all — the per-profile
 * calendar_token in the URL IS the authorization, so this must run with a
 * service-role client rather than the normal session-checked pattern used
 * by the other /api routes.
 */
export const config = { maxDuration: 15 }

const SLOT_TIMES = {
  breakfast: ['08', '00', '09', '00'],
  lunch: ['12', '00', '13', '00'],
  dinner: ['18', '00', '19', '00'],
}

function foldLine(line) {
  if (line.length <= 75) return line
  let out = line.slice(0, 75)
  let rest = line.slice(75)
  while (rest.length > 0) {
    out += '\r\n ' + rest.slice(0, 74)
    rest = rest.slice(74)
  }
  return out
}

function escapeText(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function fromWeekStartAndDow(weekStart, dayOfWeek) {
  const monday = new Date(`${weekStart}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() + dayOfWeek)
  return monday.toISOString().split('T')[0]
}

export default async function handler(req, res) {
  const token = String(req.query.token || '').replace(/\.ics$/i, '')
  if (!token) return res.status(400).send('Missing token')

  const admin = supabaseAdmin()
  if (!admin) return res.status(500).send('Calendar feed not configured — no Supabase service-role key found in the environment')

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('calendar_token', token)
    .single()

  if (!profile) return res.status(404).send('Not found')

  const { data: rows } = await admin
    .from('meal_plans')
    .select('id, week_start, day_of_week, meal_type, recipes(title)')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plated//Meal Plan//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Plated Meal Plan',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ]

  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  for (const row of rows || []) {
    if (!row.recipes?.title) continue
    const date = fromWeekStartAndDow(row.week_start, row.day_of_week)
    const dateCompact = date.replace(/-/g, '')
    const [sh, sm, eh, em] = SLOT_TIMES[row.meal_type] || SLOT_TIMES.dinner
    const slotLabel = row.meal_type.charAt(0).toUpperCase() + row.meal_type.slice(1)

    lines.push('BEGIN:VEVENT')
    lines.push(foldLine(`UID:${row.id}@plated.app`))
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART:${dateCompact}T${sh}${sm}00`)
    lines.push(`DTEND:${dateCompact}T${eh}${em}00`)
    lines.push(foldLine(`SUMMARY:${escapeText(`${slotLabel}: ${row.recipes.title}`)}`))
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.status(200).send(lines.join('\r\n'))
}
