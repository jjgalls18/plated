import { useEffect, useState } from 'react'

/**
 * Keeps the screen on while the calling component is mounted.
 *
 * A phone propped against the backsplash dims and locks after 30 seconds, and
 * unlocking it with floury hands is the worst part of cooking from a screen.
 * The Screen Wake Lock API fixes that; iOS supports it in Safari from 16.4 and
 * in installed home-screen apps from 18.4.
 *
 * The browser drops the lock whenever the page is hidden (app switch, lock
 * button), so it is re-requested each time the page becomes visible again.
 * Returns whether the lock is currently held, so the UI can say so — on a
 * browser without the API this is simply always false and nothing else changes.
 */
export function useWakeLock() {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock = null
    let cancelled = false

    const request = async () => {
      if (document.visibilityState !== 'visible' || lock) return
      try {
        const acquired = await navigator.wakeLock.request('screen')
        if (cancelled) { acquired.release().catch(() => {}); return }
        lock = acquired
        setHeld(true)
        lock.addEventListener('release', () => { lock = null; setHeld(false) })
      } catch {
        // Refused — low battery mode, or the page isn't focused. Not an error
        // worth showing; the screen just behaves as it always did.
      }
    }

    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      lock?.release().catch(() => {})
    }
  }, [])

  return held
}
