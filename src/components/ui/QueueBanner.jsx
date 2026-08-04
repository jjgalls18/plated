import { Link, useLocation } from 'react-router-dom'
import { Clock, ArrowRight } from 'lucide-react'
import { useCobaltStatus } from '../../hooks/useCobaltStatus'
import { useVideoQueue } from '../../hooks/useVideoQueue'

export default function QueueBanner() {
  const location = useLocation()
  const { reachable } = useCobaltStatus()
  const { pendingCount } = useVideoQueue()

  if (!reachable || pendingCount === 0 || location.pathname === '/queue') return null

  return (
    <Link
      to="/queue"
      className="safe-top flex items-center gap-3 mx-5 mt-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl active:scale-[0.98] transition-transform"
    >
      <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
        <Clock size={15} className="text-white" />
      </div>
      <p className="flex-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
        Home server's back — {pendingCount} queued video{pendingCount !== 1 ? 's' : ''} ready to process
      </p>
      <ArrowRight size={15} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
    </Link>
  )
}
