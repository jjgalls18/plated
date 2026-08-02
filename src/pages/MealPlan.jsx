import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X, ChefHat, ShoppingCart, Search, List, CalendarDays, CalendarPlus, Copy, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import {
  DndContext, DragOverlay,
  useDraggable, useDroppable,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import { useAppStore } from '../stores/useAppStore'
import { useRecipes } from '../hooks/useRecipes'
import { useGrocery } from '../hooks/useGrocery'
import { useMealPlan } from '../hooks/useMealPlan'
import PageHeader from '../components/ui/PageHeader'
import toast from 'react-hot-toast'

const SLOTS = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳', dot: 'bg-yellow-400' },
  { key: 'lunch',     label: 'Lunch',     emoji: '🥗', dot: 'bg-emerald-400' },
  { key: 'dinner',    label: 'Dinner',    emoji: '🍽️', dot: 'bg-primary' },
]

// Safe getter — handles legacy string format
function getDaySlots(mealPlan, date) {
  const v = mealPlan[date]
  if (!v || typeof v === 'string') return {}
  return v
}

function getWeekDates(offset = 0) {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - now.getDay() + 1 + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function formatWeekRange(dates) {
  const first = new Date(dates[0] + 'T00:00:00')
  const last  = new Date(dates[6] + 'T00:00:00')
  if (first.getMonth() === last.getMonth()) {
    return first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  return `${first.toLocaleDateString('en-US', { month: 'short' })} – ${last.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

function getMonthGrid(year, month) {
  const firstDow = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push(date)
  }
  return cells
}

// ─── Drag primitives ──────────────────────────────────────────────────────────

function DroppableSlot({ id, anyDragActive, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`transition-colors ${isOver && anyDragActive ? 'bg-primary/5' : ''}`}
    >
      {children}
    </div>
  )
}

function DraggableRecipe({ id, isActive, recipe }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex-1 flex items-center gap-2.5 min-w-0 touch-none select-none transition-opacity ${isActive ? 'opacity-30' : ''}`}
    >
      <Link
        to={`/recipe/${recipe.id}`}
        draggable={false}
        className="flex-1 flex items-center gap-2.5 min-w-0"
      >
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-warm-100 dark:bg-stone-700">
          {recipe.thumbnail_url ? (
            <img src={recipe.thumbnail_url} alt={recipe.title} className="w-full h-full object-cover" draggable={false} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat size={14} className="text-warm-300 dark:text-stone-600" />
            </div>
          )}
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-stone-50 truncate">{recipe.title}</span>
      </Link>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MealPlan() {
  const [view, setView] = useState('list')
  const [weekOffset, setWeekOffset] = useState(0)
  const [calOffset, setCalOffset] = useState(0)
  const [pickerState, setPickerState] = useState(null) // { date, slot }
  const [selectedDay, setSelectedDay] = useState(null)
  const [activeDrag, setActiveDrag] = useState(null)   // { id, recipe }
  const [showCalendarModal, setShowCalendarModal] = useState(false)

  const { profile } = useAuth()
  const { incrementGroceryListsGenerated } = useAppStore()
  const { mealPlan, setMealPlan, removeMealPlan } = useMealPlan()
  const { data: recipes = [] } = useRecipes()
  const { addItems } = useGrocery()

  const today = new Date().toISOString().split('T')[0]
  const weekDates = getWeekDates(weekOffset)

  const calDate = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + calOffset)
    return { year: d.getFullYear(), month: d.getMonth() }
  }, [calOffset])

  const calGrid = useMemo(() => getMonthGrid(calDate.year, calDate.month), [calDate])

  const getRecipe = (id) => recipes.find((r) => r.id === id)

  const handlePlan = (date, slot) => setPickerState({ date, slot })
  const handleRemove = (date, slot) => removeMealPlan(date, slot)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const handleDragStart = ({ active }) => {
    const [date, slot] = active.id.split('__')
    const slots = getDaySlots(mealPlan, date)
    const recipe = getRecipe(slots[slot])
    if (recipe) setActiveDrag({ id: active.id, recipe })
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveDrag(null)
    if (!over || active.id === over.id) return

    const [srcDate, srcSlot] = active.id.split('__')
    const [dstDate, dstSlot] = over.id.split('__')

    const srcRecipeId = getDaySlots(mealPlan, srcDate)[srcSlot]
    const dstRecipeId = getDaySlots(mealPlan, dstDate)[dstSlot]

    if (!srcRecipeId) return

    if (dstRecipeId) {
      // Swap
      setMealPlan(srcDate, srcSlot, dstRecipeId)
      setMealPlan(dstDate, dstSlot, srcRecipeId)
    } else {
      // Move
      setMealPlan(dstDate, dstSlot, srcRecipeId)
      removeMealPlan(srcDate, srcSlot)
    }
  }

  const handleAddToGrocery = async () => {
    const allIngredients = weekDates.flatMap((date) => {
      const slots = getDaySlots(mealPlan, date)
      return SLOTS.flatMap(({ key }) => {
        const recipe = slots[key] ? getRecipe(slots[key]) : null
        return recipe?.ingredients || []
      })
    })
    if (!allIngredients.length) return toast('No meals planned this week')
    await addItems(allIngredients)
    incrementGroceryListsGenerated()
    toast.success(`${allIngredients.length} ingredients added to grocery list`)
  }

  const calMonthLabel = new Date(calDate.year, calDate.month, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <PageHeader />

      <div className="px-5 pb-nav">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-stone-50">Meal Plan</h1>
            <p className="text-sm text-warm-400 dark:text-stone-500 mt-0.5">
              {view === 'list' ? formatWeekRange(weekDates) : calMonthLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCalendarModal(true)}
              className="w-9 h-9 flex items-center justify-center bg-white dark:bg-stone-800 rounded-xl shadow-card text-gray-700 dark:text-stone-200 active:scale-95 transition-transform flex-shrink-0"
            >
              <CalendarPlus size={15} />
            </button>
            {view === 'list' && (
              <button
                onClick={handleAddToGrocery}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-stone-800 rounded-xl shadow-card text-xs font-semibold text-gray-700 dark:text-stone-200 active:scale-95 transition-transform"
              >
                <ShoppingCart size={13} />
                Add week
              </button>
            )}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex bg-white dark:bg-stone-800 rounded-2xl p-1 shadow-card mb-4">
          <button
            onClick={() => setView('list')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              view === 'list'
                ? 'bg-primary text-white shadow-sm'
                : 'text-warm-400 dark:text-stone-500'
            }`}
          >
            <List size={13} /> 7-Day List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              view === 'calendar'
                ? 'bg-primary text-white shadow-sm'
                : 'text-warm-400 dark:text-stone-500'
            }`}
          >
            <CalendarDays size={13} /> Calendar
          </button>
        </div>

        {/* ─── LIST VIEW ─── */}
        {view === 'list' && (
          <>
            {/* Week navigator */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setWeekOffset(weekOffset - 1)}
                className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card active:scale-90 transition-transform"
              >
                <ChevronLeft size={18} className="text-gray-700 dark:text-stone-200" />
              </button>
              <button onClick={() => setWeekOffset(0)} className="text-xs font-semibold text-primary">
                {weekOffset === 0 ? 'This week' : 'Back to today'}
              </button>
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card active:scale-90 transition-transform"
              >
                <ChevronRight size={18} className="text-gray-700 dark:text-stone-200" />
              </button>
            </div>

            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="space-y-3">
                {weekDates.map((date) => (
                  <DayCard
                    key={date}
                    date={date}
                    isToday={date === today}
                    isPast={date < today}
                    slots={getDaySlots(mealPlan, date)}
                    getRecipe={getRecipe}
                    onPlan={handlePlan}
                    onRemove={handleRemove}
                    activeDragId={activeDrag?.id ?? null}
                  />
                ))}
              </div>

              <DragOverlay dropAnimation={null}>
                {activeDrag ? (
                  <div className="flex items-center gap-2.5 bg-white dark:bg-stone-800 rounded-xl shadow-lg px-3 py-2.5 opacity-95 scale-105">
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-warm-100 dark:bg-stone-700">
                      {activeDrag.recipe.thumbnail_url ? (
                        <img src={activeDrag.recipe.thumbnail_url} alt={activeDrag.recipe.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ChefHat size={14} className="text-warm-300 dark:text-stone-600" />
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-stone-50 max-w-[140px] truncate">
                      {activeDrag.recipe.title}
                    </span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </>
        )}

        {/* ─── CALENDAR VIEW ─── */}
        {view === 'calendar' && (
          <>
            {/* Month navigator */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCalOffset(calOffset - 1)}
                className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card active:scale-90 transition-transform"
              >
                <ChevronLeft size={18} className="text-gray-700 dark:text-stone-200" />
              </button>
              <button onClick={() => setCalOffset(0)} className="text-xs font-semibold text-primary">
                {calOffset === 0 ? 'This month' : 'Back to today'}
              </button>
              <button
                onClick={() => setCalOffset(calOffset + 1)}
                className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card active:scale-90 transition-transform"
              >
                <ChevronRight size={18} className="text-gray-700 dark:text-stone-200" />
              </button>
            </div>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-warm-400 dark:text-stone-500 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-7 gap-1 bg-white dark:bg-stone-800 rounded-2xl shadow-card p-3">
              {calGrid.map((date, i) => {
                if (!date) return <div key={`empty-${i}`} />
                const slots = getDaySlots(mealPlan, date)
                const plannedSlots = SLOTS.filter(s => slots[s.key])
                const isToday = date === today
                const isSelected = date === selectedDay
                const d = new Date(date + 'T00:00:00')
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDay(selectedDay === date ? null : date)}
                    className={`flex flex-col items-center py-1.5 rounded-xl transition-all active:scale-90 ${
                      isSelected ? 'bg-primary/10 dark:bg-primary/20' : ''
                    }`}
                  >
                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-primary text-white'
                        : 'text-gray-900 dark:text-stone-50'
                    }`}>
                      {d.getDate()}
                    </span>
                    <div className="flex gap-0.5 mt-0.5 h-2 items-center">
                      {plannedSlots.map(s => (
                        <span key={s.key} className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 justify-center mt-3">
              {SLOTS.map(s => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className="text-[10px] text-warm-400 dark:text-stone-500 font-medium">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Day detail panel */}
            {selectedDay && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900 dark:text-stone-50">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <button onClick={() => setSelectedDay(null)} className="text-warm-300 dark:text-stone-600">
                    <X size={16} />
                  </button>
                </div>
                <DayCard
                  date={selectedDay}
                  isToday={selectedDay === today}
                  isPast={selectedDay < today}
                  slots={getDaySlots(mealPlan, selectedDay)}
                  getRecipe={getRecipe}
                  onPlan={handlePlan}
                  onRemove={handleRemove}
                  activeDragId={null}
                />
                <button
                  onClick={async () => {
                    const slots = getDaySlots(mealPlan, selectedDay)
                    const ingredients = SLOTS.flatMap(({ key }) => {
                      const recipe = slots[key] ? getRecipe(slots[key]) : null
                      return recipe?.ingredients || []
                    })
                    if (!ingredients.length) return toast('No meals planned for this day')
                    await addItems(ingredients)
                    incrementGroceryListsGenerated()
                    toast.success(`${ingredients.length} ingredients added`)
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-stone-800 rounded-xl shadow-card text-xs font-semibold text-gray-700 dark:text-stone-200 active:scale-95 transition-transform"
                >
                  <ShoppingCart size={13} /> Add day to grocery
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Recipe Picker */}
      {pickerState && (
        <RecipePicker
          date={pickerState.date}
          slot={SLOTS.find(s => s.key === pickerState.slot)}
          recipes={recipes}
          onSelect={async (recipeId) => {
            setMealPlan(pickerState.date, pickerState.slot, recipeId)
            setPickerState(null)
            toast.success('Meal planned!')
          }}
          onClose={() => setPickerState(null)}
        />
      )}

      {/* Apple Calendar subscribe */}
      {showCalendarModal && (
        <CalendarSubscribeModal token={profile?.calendar_token} onClose={() => setShowCalendarModal(false)} />
      )}
    </div>
  )
}

function CalendarSubscribeModal({ token, onClose }) {
  const [copied, setCopied] = useState(false)
  const host = typeof window !== 'undefined' ? window.location.host : ''
  const httpsUrl = token ? `https://${host}/api/calendar/${token}.ics` : null
  const webcalUrl = token ? `webcal://${host}/api/calendar/${token}.ics` : null

  const handleCopy = async () => {
    if (!httpsUrl) return
    await navigator.clipboard.writeText(httpsUrl)
    setCopied(true)
    toast.success('Link copied')
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pb-10 px-5" onClick={onClose}>
      <div className="w-full max-w-sm bg-white dark:bg-stone-800 rounded-3xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
            <CalendarPlus size={18} className="text-primary" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-stone-50 text-lg">Apple Calendar</h3>
        </div>

        {!token ? (
          <p className="text-sm text-warm-400 dark:text-stone-400 mb-5">
            Calendar sync isn't set up yet — check back after the next update.
          </p>
        ) : (
          <>
            <p className="text-sm text-warm-400 dark:text-stone-400 mb-5 leading-relaxed">
              Subscribe once and your meal plan stays in sync — new meals show up automatically,
              no re-importing. On iPhone, tap below to open it directly in Calendar.
            </p>
            <a
              href={webcalUrl}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white rounded-2xl font-semibold text-sm shadow-soft active:scale-95 transition-all mb-3"
            >
              <CalendarPlus size={16} />
              Subscribe in Calendar
            </a>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-3 bg-warm-100 dark:bg-stone-700 text-gray-700 dark:text-stone-200 rounded-2xl font-semibold text-xs active:scale-95 transition-all mb-1"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy link instead'}
            </button>
            <p className="text-[11px] text-warm-400 dark:text-stone-500 text-center mb-4">
              Or paste manually: Settings → Calendar → Accounts → Add Subscribed Calendar
            </p>
          </>
        )}

        <button onClick={onClose} className="w-full py-3 rounded-2xl bg-warm-100 dark:bg-stone-700 text-sm font-semibold text-gray-700 dark:text-stone-200">
          Close
        </button>
      </div>
    </div>
  )
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

function DayCard({ date, isToday, isPast, slots, getRecipe, onPlan, onRemove, activeDragId }) {
  const d = new Date(date + 'T00:00:00')
  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' })
  const dayNum = d.getDate()

  return (
    <div className={`bg-white dark:bg-stone-800 rounded-2xl shadow-card overflow-hidden ${
      isToday ? 'ring-2 ring-primary' : ''
    } ${isPast ? 'opacity-60' : ''}`}>
      {/* Day header */}
      <div className={`px-4 py-2 flex items-center gap-2 border-b border-warm-100 dark:border-stone-700 ${
        isToday ? 'bg-primary/5 dark:bg-primary/10' : ''
      }`}>
        <span className={`text-[11px] font-bold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-warm-400 dark:text-stone-500'}`}>
          {dayLabel}
        </span>
        <span className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-gray-900 dark:text-stone-50'}`}>
          {dayNum}
        </span>
        {isToday && (
          <span className="ml-auto text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            Today
          </span>
        )}
      </div>

      {/* Meal slots */}
      <div className="divide-y divide-warm-100 dark:divide-stone-700/60">
        {SLOTS.map(({ key, label, emoji }) => {
          const recipeId = slots[key]
          const recipe = recipeId ? getRecipe(recipeId) : null
          const slotId = `${date}__${key}`
          const isActive = activeDragId === slotId

          return (
            <DroppableSlot key={key} id={slotId} anyDragActive={!!activeDragId}>
              <div className="flex items-center gap-3 px-3 py-2.5 min-h-[48px]">
                <span className="text-base w-6 text-center flex-shrink-0 leading-none">{emoji}</span>
                {recipe ? (
                  <>
                    <DraggableRecipe id={slotId} isActive={isActive} recipe={recipe} />
                    <button
                      onClick={() => onRemove(date, key)}
                      className="p-1 text-warm-300 dark:text-stone-600 hover:text-red-400 transition-colors flex-shrink-0 active:scale-90"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onPlan(date, key)}
                    className="flex-1 text-left text-xs font-medium text-warm-300 dark:text-stone-600 active:text-primary transition-colors py-1"
                  >
                    + Add {label.toLowerCase()}
                  </button>
                )}
              </div>
            </DroppableSlot>
          )
        })}
      </div>
    </div>
  )
}

// ─── Recipe Picker ────────────────────────────────────────────────────────────

function RecipePicker({ date, slot, recipes, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const d = new Date(date + 'T00:00:00')
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  const filtered = recipes.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream dark:bg-stone-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-14 pb-4 bg-cream dark:bg-stone-900">
        <button
          onClick={onClose}
          className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card"
        >
          <X size={18} className="text-gray-700 dark:text-stone-200" />
        </button>
        <div>
          <p className="text-xs text-warm-400 dark:text-stone-500 font-medium">
            {slot?.emoji} {slot?.label} · {dateLabel}
          </p>
          <p className="font-semibold text-gray-900 dark:text-stone-50">Choose a recipe</p>
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
