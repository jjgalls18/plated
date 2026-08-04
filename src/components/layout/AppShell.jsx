import BottomNav from './BottomNav'
import QueueBanner from '../ui/QueueBanner'

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <QueueBanner />
      <main className="pb-nav">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
