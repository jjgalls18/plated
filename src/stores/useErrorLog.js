import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_ENTRIES = 40

/**
 * A running record of what failed and why.
 *
 * Toasts vanish and queue rows get deleted, so until now a failure left nothing
 * behind to diagnose from — you'd know an extraction broke but not at which
 * step or with what message. This keeps the last few dozen, with the step that
 * was running when it went wrong, and survives a reload.
 *
 * Local to the device on purpose: it's a debugging aid, not shared state, and
 * it should still work when the failure is "can't reach the database".
 */
export const useErrorLog = create(
  persist(
    (set) => ({
      entries: [],

      logError: ({ source, url, step, message, detail }) =>
        set((s) => ({
          entries: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              at: new Date().toISOString(),
              source,                       // 'video' | 'web' | 'photo'
              url: url || null,
              step: step || null,           // what was running when it failed
              message: message || 'Unknown error',
              detail: detail || null,
            },
            ...s.entries,
          ].slice(0, MAX_ENTRIES),
        })),

      clearErrors: () => set({ entries: [] }),
    }),
    { name: 'plated-error-log' },
  ),
)

/** One entry as copyable text, so a failure can be pasted somewhere useful. */
export function formatErrorEntry(e) {
  return [
    `[${e.at}] ${e.source}${e.step ? ` — ${e.step}` : ''}`,
    e.url ? `url: ${e.url}` : null,
    `error: ${e.message}`,
    e.detail ? `detail: ${e.detail}` : null,
  ].filter(Boolean).join('\n')
}
