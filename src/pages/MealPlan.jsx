import { useState } from 'react'
import { ChevronLeft, ChevronRight, X, ChefHat, ShoppingCart, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/useAppStore'
import { useRecipes } from '../hooks/useRecipes'
import PageHeader from '../components/ui/PageHeader'
import toast from 'react-hot-toast'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function getWeekDates(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1 + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function formatMonthRange(dates) {
  const first = new Date(dates[0] + 'T00:00:00')
  const last = new Date(dates[6] + 'T00:00:00')
  if (first.getMonth() === last.getMonth()) {
    return first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  return `${first.toLocaleDateString('en-US', { month: 'short' })} – ${last.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

export default function MealPlan() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [pickerDate, setPickerDate] = useState(null)
  const { mealPlan, setMealPlan, removeMealPlan, addGroceryItem, incrementGroceryListsGenerated } = useAppStore()
  const { data: recipes = [] } = useRecipes()

  const weekDates = getWeekDates(weekOffset)
  const today = new Date().toISOString().split('T')[0]

  const getRecipe = (id) => recipes.find((r) => r.id === id)

  const handleAddToGrocery = () => {
    const planned = weekDates.filter((d) => mealPlan[d])
    if (planned.length === 0) return toast('No meals planned this week')
    let count = 0
    planned.forEach((d) => {
      const recipe = getRecipe(mealPlan[d])
      recipe?.ingredients?.forEach((ing) => {
        addGroceryItem({ name: ing.name, amount: ing.amount })
        count++
      })
    })
    incrementGroceryListsGenerated()
    toast.success(`${count} ingredients added to grocery list`)
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <PageHeader />

      <div className="px-5 pb-nav">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-stone-50">Meal Plan</h1>
            <p className="text-sm text-warm-400 dark:text-stone-500 mt-0.5">{formatMonthRange(weekDates)}</p>
          </div>
          <button
            onClick={handleAddToGrocery}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-stone-800 rounded-xl shadow-card text-xs font-semibold text-gray-700 dark:text-stone-200 active:scale-95 transition-transform"
          >
            <ShoppingCart size={13} />
            Add week to grocery
          </button>
        </div>

        {/* Week navigator */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card active:scale-90 transition-transform"
          >
            <ChevronLeft size={18} className="text-gray-700 dark:text-stone-200" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="text-xs font-semibold text-primary"
          >
            {weekOffset === 0 ? 'This week' : 'Back to today'}
          </button>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card active:scale-90 transition-transform"
          >
            <ChevronRight size={18} className="text-gray-700 dark:text-stone-200" />
          </button>
        </div>

        {/* Day cards */}
        <div className="space-y-3">
          {weekDates.map((date, i) => {
            const isToday = date === today
            const isPast = date < today
            const recipeId = mealPlan[date]
            const recipe = recipeId ? getRecipe(recipeId) : null
            const d = new Date(date + 'T00:00:00')

            return (
              <div
                key={date}
                className={`flex items-center gap-3 bg-white dark:bg-stone-800 rounded-2xl shadow-card p-3 ${
                  isToday ? 'ring-2 ring-primary' : ''
                } ${isPast ? 'opacity-60' : ''}`}
              >
                {/* Day label */}
                <div className={`w-12 text-center flex-shrink-0 ${isToday ? 'text-primary' : 'text-warm-400 dark:text-stone-500'}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide">{DAYS[(i + 1) % 7]}</p>
                  <p className="text-xl font-bold leading-tight">{d.getDate()}</p>
                </div>

                {/* Recipe slot */}
                {recipe ? (
                  <Link to={`/recipe/${recipe.id}`} className="flex-1 flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-warm-100 dark:bg-stone-700">
                      {recipe.thumbnail_url ? (
                        <img src={recipe.thumbnail_url} alt={recipe.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ChefHat size={20} className="text-warm-300 dark:text-stone-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-stone-50 truncate">{recipe.title}</p>
                      {((recipe.prep_time || 0) + (recipe.cook_time || 0)) > 0 && (
                        <p className="text-xs text-warm-400 dark:text-stone-500 mt-0.5">
                          {(recipe.prep_time || 0) + (recipe.cook_time || 0)} min
                        </p>
                      )}
                    </div>
                  </Link>
                ) : (
                  <button
                    onClick={() => setPickerDate(date)}
                    className="flex-1 flex items-center gap-2 py-3 px-2 rounded-xl border-2 border-dashed border-warm-200 dark:border-stone-600 text-warm-300 dark:text-stone-600 active:scale-95 transition-transform"
                  >
                    <ChefHat size={16} />
                    <span className="text-xs font-medium">Plan a meal</span>
                  </button>
                )}

                {/* Remove button */}
                {recipe && (
                  <button
                    onClick={(e) => { e.preventDefault(); removeMealPlan(date) }}
                    className="w-7 h-7 flex items-center justify-center text-warm-300 dark:text-stone-600 hover:text-red-400 transition-colors active:scale-90 flex-shrink-0"
                  >
                    <X size={15} />
                  </button>
                )}
                {!recipe && (
                  <button
                    onClick={() => setPickerDate(date)}
                    className="w-7 h-7 flex-shrink-0"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Recipe Picker Modal */}
      {pickerDate && (
        <RecipePicker
          date={pickerDate}
          recipes={recipes}
          onSelect={(recipeId) => {
            setMealPlan(pickerDate, recipeId)
            setPickerDate(null)
            toast.success('Meal planned!')
          }}
          onClose={() => setPickerDate(null)}
        />
      )}
    </div>
  )
}

function RecipePicker({ date, recipes, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const d = new Date(date + 'T00:00:00')
  const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  const filtered = recipes.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream dark:bg-stone-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-14 pb-4 bg-cream dark:bg-stone-900">
        <button onClick={onClose} className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card">
          <X size={18} className="text-gray-700 dark:text-stone-200" />
        </button>
        <div>
          <p className="text-xs text-warm-400 dark:text-stone-500 font-medium">Planning for</p>
          <p className="font-semibold text-gray-900 dark:text-stone-50">{label}</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 pb-3">
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes..."
            autoFocus
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-stone-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-primary/30 shadow-card"
          />
        </div>
      </div>

      {/* Recipe list */}
      <div className="flex-1 overflow-y-auto px-5 pb-10 space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-warm-400 dark:text-stone-500 mt-10">No recipes found</p>
        )}
        {filtered.map((recipe) => (
          <button
            key={recipe.id}
            onClick={() => onSelect(recipe.id)}
            className="w-full flex items-center gap-3 bg-white dark:bg-stone-800 rounded-2xl shadow-card p-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-warm-100 dark:bg-stone-700">
              {recipe.thumbnail_url ? (
                <img src={recipe.thumbnail_url} alt={recipe.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ChefHat size={20} className="text-warm-300 dark:text-stone-600" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-stone-50 truncate">{recipe.title}</p>
              <div className="flex gap-3 mt-0.5">
                {((recipe.prep_time || 0) + (recipe.cook_time || 0)) > 0 && (
                  <p className="text-xs text-warm-400 dark:text-stone-500">
                    {(recipe.prep_time || 0) + (recipe.cook_time || 0)} min
                  </p>
                )}
                {recipe.tags?.slice(0, 2).map((t) => (
                  <span key={t} className="text-[10px] font-semibold text-primary capitalize">{t}</span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
