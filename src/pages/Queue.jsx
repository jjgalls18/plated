import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, RefreshCw, Trash2, Play, ChefHat, AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react'
import { useVideoQueue } from '../hooks/useVideoQueue'
import { useCobaltStatus } from '../hooks/useCobaltStatus'
import { useManualExtraction } from '../hooks/useManualExtraction'
import { useQueueProgress } from '../stores/useQueueProgress'
import toast from 'react-hot-toast'

const STATUS_META = {
  queued: { label: 'Queued', color: 'bg-warm-100 dark:bg-stone-700 text-warm-500 dark:text-stone-400' },
  partial: { label: 'Partial recipe — full extraction pending', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  processing: { label: 'Extracting now', color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' },
  complete: { label: 'Complete', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  failed: { label: 'Failed', color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' },
}

export default function Queue() {
  const navigate = useNavigate()
  const { items, updateQueueItem, removeFromQueue } = useVideoQueue()
  const { reachable, checking, refresh } = useCobaltStatus()
  const { extractNow, running, hasKeys } = useManualExtraction()
  const { activeId, step: localStep } = useQueueProgress()

  const pending = items.filter((i) => i.status === 'queued' || i.status === 'partial' || i.status === 'processing')
  const anyProcessing = pending.some((i) => i.status === 'processing')
  const finished = items.filter((i) => i.status === 'complete' || i.status === 'failed')

  /**
   * Puts a failed video back in line. Attempts are capped per item so a broken
   * link can't loop through Whisper credits, so the count has to be cleared for
   * the worker to pick it up at all.
   */
  const retryItem = async (item) => {
    await updateQueueItem(item.id, { status: 'queued', error_message: null, attempts: 0 })
    toast.success(reachable ? 'Back in the queue' : 'Queued — will run when the home server is reachable')
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <div className="px-5 pt-14 pb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card">
          <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-stone-50">Queue</h1>
          <p className="text-warm-400 dark:text-stone-500 text-xs mt-0.5">
            {anyProcessing ? 'Extracting now — you can close the app' : 'The home server extracts these on its own'}
          </p>
        </div>
        <button
          onClick={() => refresh()}
          className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card"
        >
          <RefreshCw size={15} className={`text-gray-700 dark:text-stone-300 ${checking ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-5 pb-nav space-y-3">
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl ${reachable ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${reachable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <p className={`text-xs font-semibold ${reachable ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
            {reachable ? 'Home server reachable' : 'Home server unreachable'}
          </p>
        </div>

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Clock size={32} className="text-warm-300 dark:text-stone-600 mb-3" />
            <p className="font-semibold text-gray-700 dark:text-stone-300 mb-1">Nothing queued</p>
            <p className="text-sm text-warm-400 dark:text-stone-500">Paste a video link and it lands here, then extracts on its own — no need to keep Plated open</p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="space-y-2.5">
            {pending.map((item, index) => (
              <QueueCard
                key={item.id}
                item={item}
                reachable={reachable}
                position={index + 1}
                queueLength={pending.length}
                // A run started on this device reports through local state; the
                // worker reports through the row. Prefer whichever is live.
                step={activeId === item.id ? localStep : (item.progress_step || '')}
                processing={item.status === 'processing'}
                onExtractHere={hasKeys && !running ? () => extractNow(item.id) : null}
                onRemove={() => removeFromQueue(item.id)}
              />
            ))}
          </div>
        )}

        {finished.length > 0 && (
          <div className="pt-2">
            <p className="text-[11px] font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-2">History</p>
            <div className="space-y-2.5">
              {finished.map((item) => (
                <QueueCard key={item.id} item={item} reachable={reachable} onRetry={() => retryItem(item)} onRemove={() => removeFromQueue(item.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function QueueCard({ item, reachable, processing, position, queueLength, step, onRetry, onExtractHere, onRemove }) {
  const navigate = useNavigate()
  const meta = STATUS_META[item.status] || STATUS_META.queued
  const title = item.partial_recipe?.title || item.url
  const waiting = position > 1 && !processing

  // Worth distinguishing: work on the home server survives closing the app,
  // work on this device does not.
  const processingLabel = item.claimed_by === 'this device'
    ? 'Extracting on this device'
    : item.claimed_by ? 'Extracting on the home server' : meta.label

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-warm-100 dark:bg-stone-700 flex items-center justify-center flex-shrink-0">
          {item.status === 'complete' ? <CheckCircle2 size={18} className="text-emerald-500" />
            : item.status === 'failed' ? <AlertTriangle size={18} className="text-rose-500" />
            : <ChefHat size={18} className="text-warm-400 dark:text-stone-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-stone-50 truncate">{title}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>
            {waiting ? `Next up · ${position} of ${queueLength}` : processing ? processingLabel : meta.label}
          </span>
          {processing && step && (
            <p className="flex items-center gap-1.5 text-[11px] text-violet-600 dark:text-violet-400 mt-1.5 font-medium">
              <RefreshCw size={11} className="animate-spin flex-shrink-0" />
              {step}
            </p>
          )}
          {item.status === 'failed' && item.error_message && (
            <p className="text-[11px] text-rose-500 mt-1 break-words">{item.error_message}</p>
          )}
        </div>
        <button onClick={onRemove} className="p-1.5 text-warm-300 dark:text-stone-600 hover:text-rose-400 transition-colors flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
      {item.status === 'failed' && onRetry && (
        <button
          onClick={onRetry}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold active:scale-95 transition-all"
        >
          <RefreshCw size={13} />
          Try again
        </button>
      )}

      {item.status === 'complete' && item.final_recipe_id && (
        <button
          onClick={() => navigate(`/recipe/${item.final_recipe_id}`)}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-warm-100 dark:bg-stone-700 text-gray-700 dark:text-stone-200 rounded-xl text-xs font-semibold active:scale-95 transition-all"
        >
          <Play size={13} />
          View recipe
        </button>
      )}

      {/* The escape hatch for the worker being down while Cobalt is up. Closing
          the app cancels it, which is exactly why it isn't the default. */}
      {!processing && reachable && onExtractHere && (item.status === 'queued' || item.status === 'partial') && (
        <button
          onClick={onExtractHere}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-warm-100 dark:bg-stone-700 text-gray-600 dark:text-stone-300 rounded-xl text-xs font-semibold active:scale-95 transition-all"
        >
          <Smartphone size={13} />
          Extract on this device
        </button>
      )}

      {!reachable && (item.status === 'queued' || item.status === 'partial') && (
        <p className="text-[11px] text-warm-400 dark:text-stone-500 mt-2">Waiting for the home server</p>
      )}
    </div>
  )
}
