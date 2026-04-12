import BottomNav from './BottomNav'

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <main className="pb-nav">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
