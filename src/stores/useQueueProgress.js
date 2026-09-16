import { create } from 'zustand'

/**
 * Live progress for a video being extracted *in this tab*.
 *
 * Only the manual "Extract on this device" path writes here. Everything the
 * homelab worker does is reported through the queue row's progress_step column
 * instead, because a step label only this browser knows about is no use to the
 * other phone — and useless the moment the app is closed, which is now the
 * normal case.
 *
 * Deliberately not persisted: this describes work happening right now, and a
 * step label restored from localStorage after a reload would describe a run
 * that is no longer happening.
 *
 * Attempt counts used to live here too. They are a column on video_queue now —
 * per-device counts meant a persistent failure got a fresh two tries from every
 * device and every reload, spending Whisper and Claude credits each time.
 */
export const useQueueProgress = create((set) => ({
  activeId: null,
  step: '',
  setProgress: (activeId, step) => set({ activeId, step }),
  clear: () => set({ activeId: null, step: '' }),
}))
