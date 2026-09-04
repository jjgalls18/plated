import { Link, useLocation } from 'react-router-dom'
import { Clock, ArrowRight, RefreshCw } from 'lucide-react'
import { useCobaltStatus } from '../../hooks/useCobaltStatus'
import { useVideoQueue } from '../../hooks/useVideoQueue'
import { useQueueProgress } from '../../stores/useQueueProgress'

/**
 * Ambient status for background extraction. Extraction now runs while you're
 * anywhere in the app, so there has to be somewhere other than the queue page
 * that shows it's happening — otherwise adding a link looks like it did
 * nothing until a recipe silently appears.
 */
export default function QueueBanner() {
  const location = useLocation()
  const { reachable } = useCobaltStatus()
  const { items, pendingCount } = useVideoQueue()
  const { step } = useQueueProgress()

  const processing = items.some((i) => i.status === 'processing')
  if (location.pathname === '/queue') return null
  if (!processing && (!reachable || pendingCount === 0)) return null

  const waiting = pendingCount - (processing ? 1 : 0)

  return (
    <Link
      to="/queue"
      className={`safe-top flex items-center gap-3 mx-5 mt-3 px-4 py-3 rounded-2xl active:scale-[0.98] transition-transform ${
        processing ? 'bg-violet-50 dark:bg-violet-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'
      }`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${processing ? 'bg-violet-500' : 'bg-emerald-500'}`}>
        {processing
          ? <RefreshCw size={15} className="text-white animate-spin" />
          : <Clock size={15} className="text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate ${processing ? 'text-violet-800 dark:text-violet-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
          {processing
            ? (step || 'Extracting recipe…')
            : `${pendingCount} video${pendingCount !== 1 ? 's' : ''} ready to extract`}
        </p>
        {processing && waiting > 0 && (
          <p className="text-[10px] text-violet-600/70 dark:text-violet-400/70">{waiting} more waiting</p>
        )}
      </div>
      <ArrowRight size={15} className={`flex-shrink-0 ${processing ? 'text-violet-600 dark:text-violet-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
    </Link>
  )
}
