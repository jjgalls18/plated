import { CalendarDays } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

export default function MealPlan() {
  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <PageHeader />
      <div className="px-5 pt-2 pb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-stone-50 mb-1">Meal Plan</h1>
        <p className="text-warm-400 dark:text-stone-500 text-sm">Plan your week</p>
      </div>

      <div className="px-5">
        <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-card p-8 text-center">
          <div className="w-20 h-20 bg-warm-100 dark:bg-stone-700 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CalendarDays size={36} className="text-primary" />
          </div>
          <h3 className="font-display font-semibold text-xl text-gray-900 dark:text-stone-50 mb-2">Coming soon</h3>
          <p className="text-warm-400 dark:text-stone-500 text-sm leading-relaxed max-w-xs mx-auto">
            Drag and drop your recipes into a weekly plan, sync to Apple Calendar, and see what's for dinner all week long.
          </p>
        </div>
      </div>
    </div>
  )
}
