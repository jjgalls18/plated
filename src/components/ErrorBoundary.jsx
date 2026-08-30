import { Component } from 'react'
import { AlertCircle } from 'lucide-react'

const RELOAD_KEY = 'plated-stale-reload-at'
const RELOAD_COOLDOWN = 30 * 1000

/**
 * A failed dynamic import nearly always means this client is running an old
 * build. Vite gives every chunk a content-hashed filename and Vercel deletes
 * the previous deploy's assets, so an installed PWA holding a stale index.html
 * asks for chunks that now 404. React.lazy rejects, and without a boundary the
 * whole tree unmounts — the app just goes blank.
 */
function isStaleBuildError(error) {
  const text = `${error?.name || ''} ${error?.message || ''}`
  return /loading chunk|loading css chunk|failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(text)
}

/**
 * Drops the service worker and its caches before reloading. A plain
 * location.reload() can be served the same stale index.html by the very
 * service worker that caused the problem, which would just loop.
 */
async function reloadWithoutCaches() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch { /* best effort — reload regardless */ }
  window.location.reload()
}

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    if (!isStaleBuildError(error)) return

    // Reload at most once per cooldown. If a fresh build still throws this,
    // the recovery isn't working and an error screen beats a reload loop.
    let last = 0
    try { last = Number(sessionStorage.getItem(RELOAD_KEY) || 0) } catch { /* private mode */ }
    if (Date.now() - last < RELOAD_COOLDOWN) return

    try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch { /* private mode */ }
    reloadWithoutCaches()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const stale = isStaleBuildError(error)

    return (
      <div className="min-h-screen bg-cream dark:bg-stone-900 flex flex-col items-center justify-center px-5 text-center">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle size={32} className="text-rose-500" />
        </div>
        <h2 className="font-display font-bold text-xl text-gray-900 dark:text-stone-50 mb-2">
          {stale ? 'Plated needs to update' : 'Something broke'}
        </h2>
        <p className="text-warm-400 dark:text-stone-500 text-sm mb-6 max-w-xs break-words">
          {stale
            ? 'This app is running an old version whose files are no longer on the server. Updating should fix it.'
            : error?.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reloadWithoutCaches}
          className="px-6 py-3 bg-primary text-white rounded-2xl font-semibold text-sm active:scale-95 transition-all"
        >
          {stale ? 'Update now' : 'Reload'}
        </button>
        <p className="text-warm-400/60 dark:text-stone-600 text-[10px] mt-6 font-mono">build {__BUILD_ID__}</p>
      </div>
    )
  }
}
