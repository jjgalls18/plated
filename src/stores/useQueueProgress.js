import { create } from 'zustand'

/**
 * Live progress for the video currently being extracted.
 *
 * Deliberately separate from useAppStore and not persisted: this describes work
 * happening right now in this tab, and a step label restored from localStorage
 * after a reload would describe a run that is no longer happening.
 */
export const useQueueProgress = create((set) => ({
  activeId: null,
  step: '',
  setProgress: (activeId, step) => set({ activeId, step }),
  clear: () => set({ activeId: null, step: '' }),

  // Per-item attempt counts, so a video that fails can't be retried forever in
  // a loop. Lives here rather than in the processor so the queue's Retry button
  // can clear a count and let the processor pick the item up again.
  attempts: {},
  noteAttempt: (id) => set((s) => ({ attempts: { ...s.attempts, [id]: (s.attempts[id] || 0) + 1 } })),
  resetAttempts: (id) => set((s) => {
    const attempts = { ...s.attempts }
    delete attempts[id]
    return { attempts }
  }),
}))
