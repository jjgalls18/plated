function escapeIcsText(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/**
 * Builds a .ics file of VTODOs — the only realistic way for a web app to
 * hand items to Apple Reminders. There's no public API Reminders exposes
 * for third-party sync; opening/sharing a VTODO .ics is what iOS itself
 * offers "Add to Reminders" for.
 */
export function buildTodoIcs(items, { calName = 'Plated' } = {}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plated//Reminders//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
  ]
  items.forEach((item) => {
    lines.push('BEGIN:VTODO')
    lines.push(`UID:${item.id}@plated.app`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`SUMMARY:${escapeIcsText(item.name)}`)
    lines.push('STATUS:NEEDS-ACTION')
    lines.push('END:VTODO')
  })
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/**
 * Shares/downloads the .ics so iOS can offer "Add to Reminders". Falls back
 * to a plain download when the Web Share API (or file sharing) isn't available.
 */
export async function shareIcsFile(icsText, filename, shareTitle) {
  const file = new File([icsText], filename, { type: 'text/calendar' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: shareTitle })
      return 'shared'
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled'
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
