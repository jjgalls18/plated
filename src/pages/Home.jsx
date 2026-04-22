import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Flame, Sun, Moon, ChefHat, Trophy, Shuffle,
  Heart, Clock, Zap, ArrowRight, CalendarDays,
} from 'lucide-react'
import { useRecipes } from '../hooks/useRecipes'
import { useWeather } from '../hooks/useWeather'
import { useAppStore, calculateStreak } from '../stores/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { usePartner } from '../hooks/usePartner'
import { useCookLog } from '../hooks/useCookLog'
import PageHeader from '../components/ui/PageHeader'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff} days ago`
}

function getWeatherSuggestion(weather, recipes) {
  if (!weather || !recipes.length) return null
  const { temp } = weather

  let label, tags
  if (temp < 35) {
    label = 'Bundle-up weather — made for something cozy'
    tags = ['pasta', 'italian', 'classic']
  } else if (temp < 50) {
    label = 'Chilly out — perfect for warm comfort food'
    tags = ['pasta', 'italian', 'weeknight']
  } else if (temp < 68) {
    label = 'Great cooking weather tonight'
    tags = []
  } else if (temp < 82) {
    label = 'Nice day — keep dinner light & fresh'
    tags = ['healthy', 'quick', 'seafood']
  } else {
    label = "It's hot — something quick and easy"
    tags = ['quick', 'healthy']
  }

  const recipe = tags.length
    ? recipes.find((r) => r.tags?.some((t) => tags.includes(t)))
    : null

  return { label, recipe: recipe ?? recipes[0] }
}

const DISCOVERY_CHIPS = [
  { label: 'Date Night', icon: Heart, color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
    filter: (r) => r.tags?.includes('date night') },
  { label: 'Under 30 Min', icon: Clock, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
    filter: (r) => (r.prep_time || 0) + (r.cook_time || 0) <= 30 },
  { label: 'Low Effort', icon: Zap, color: 'bg-sage-100 text-sage-700 dark:bg-sage-900/20 dark:text-sage-300',
    filter: (r) => r.tags?.includes('low effort') || (r.prep_time || 99) <= 10 },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniRecipeCard({ recipe }) {
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)
  return (
    <Link to={`/recipe/${recipe.id}`} className="block flex-shrink-0 w-52">
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card overflow-hidden active:scale-[0.97] transition-transform">
        <div className="relative h-28">
          {recipe.thumbnail_url ? (
            <img src={recipe.thumbnail_url} alt={recipe.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-200 to-primary-400 flex items-center justify-center">
              <ChefHat size={32} className="text-white opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          {totalTime > 0 && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5">
              <Clock size={10} className="text-white" />
              <span className="text-[10px] text-white font-medium">{totalTime} min</span>
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="font-semibold text-sm text-gray-900 dark:text-stone-50 line-clamp-2 leading-snug">
            {recipe.title}
          </p>
        </div>
      </div>
    </Link>
  )
}

function StreakCard({ streak, myName = 'J', partnerName = 'M' }) {
  if (streak === 0) {
    return (
      <div className="bg-warm-100 dark:bg-stone-800 border border-warm-200 dark:border-stone-700 rounded-3xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 bg-white dark:bg-stone-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-card">
          <Flame size={28} className="text-warm-300 dark:text-stone-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-stone-50 text-base">Start your streak tonight</p>
          <p className="text-warm-400 dark:text-stone-500 text-sm mt-0.5">
            Cook something and log it — <span className="text-primary font-medium">day 1 starts now!</span>
          </p>
        </div>
      </div>
    )
  }

  const milestoneText =
    streak >= 30 ? 'Legendary cooks 🏆' :
    streak >= 14 ? "Two weeks strong 💪" :
    streak >= 7  ? "One week streak! 🌟" :
    streak >= 3  ? 'On a roll!' :
    'Nice start!'

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-100 dark:border-orange-900/30 rounded-3xl p-5">
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 flex-shrink-0">
          <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center">
            <Flame size={32} className="text-orange-500" strokeWidth={1.8} />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow">
            <span className="text-white text-[10px] font-bold">{streak}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-xl text-gray-900 dark:text-stone-50">
            {streak} day streak 🔥
          </p>
          <p className="text-orange-500 dark:text-orange-400 text-sm font-medium mt-0.5">{milestoneText}</p>
        </div>
      </div>

      {/* Person dots */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-orange-100 dark:border-orange-900/30">
        <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-soft">
          <span className="text-white text-[10px] font-bold">{myName[0]}</span>
        </div>
        <div className="flex-1 h-2 bg-orange-100 dark:bg-orange-900/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all"
            style={{ width: `${Math.min((streak / 30) * 100, 100)}%` }}
          />
        </div>
        <div className="w-7 h-7 bg-sage rounded-full flex items-center justify-center shadow-soft">
          <span className="text-white text-[10px] font-bold">{partnerName[0]}</span>
        </div>
        <span className="text-[11px] text-orange-400 dark:text-orange-500 font-semibold">{streak}/30</span>
      </div>
    </div>
  )
}

function VsCard({ jacobCooks, madiCooks, myName = 'Jacob', partnerName = 'Madi' }) {
  const total = jacobCooks + madiCooks
  const diff = Math.abs(jacobCooks - madiCooks)
  const leader = jacobCooks > madiCooks ? myName : madiCooks > jacobCooks ? partnerName : null

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide">
          Who's been cooking?
        </p>
        {leader && (
          <div className="flex items-center gap-1 text-amber-500">
            <Trophy size={12} />
            <span className="text-[11px] font-bold">{leader} is winning</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Jacob */}
        <div className="flex-1 text-center">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-soft">
            <span className="text-white font-bold text-xl">{myName[0]}</span>
          </div>
          <p className="font-bold text-3xl text-gray-900 dark:text-stone-50">{jacobCooks}</p>
          <p className="text-xs text-warm-400 dark:text-stone-500 mt-0.5">{myName}</p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-warm-300 dark:text-stone-600">VS</span>
        </div>

        {/* Madi */}
        <div className="flex-1 text-center">
          <div className="w-14 h-14 bg-sage rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-soft">
            <span className="text-white font-bold text-xl">{partnerName[0]}</span>
          </div>
          <p className="font-bold text-3xl text-gray-900 dark:text-stone-50">{madiCooks}</p>
          <p className="text-xs text-warm-400 dark:text-stone-500 mt-0.5">{partnerName}</p>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mt-4">
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            <div
              className="bg-primary rounded-full transition-all"
              style={{ flex: jacobCooks }}
            />
            <div
              className="bg-sage rounded-full transition-all"
              style={{ flex: madiCooks }}
            />
          </div>
          <p className="text-[11px] text-center text-warm-400 dark:text-stone-500 mt-2">
            {diff === 0
              ? 'Neck and neck! 🤝'
              : `${leader} is ahead by ${diff} meal${diff !== 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {total === 0 && (
        <p className="text-xs text-center text-warm-400 dark:text-stone-500 mt-4 pt-4 border-t border-warm-100 dark:border-stone-700">
          Log your first cook to start tracking — first one wins! 🏆
        </p>
      )}
    </div>
  )
}

function LastCookedCard({ entry, myId, myName = 'You', partnerName = 'Partner' }) {
  const isMe = entry.userId === myId
  return (
    <Link to={`/recipe/${entry.recipeId}`} className="block">
      <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-card overflow-hidden active:scale-[0.98] transition-transform">
        <div className="flex items-center gap-4 p-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0">
            {entry.recipeThumbnail ? (
              <img src={entry.recipeThumbnail} alt={entry.recipeTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-200 to-primary-400 flex items-center justify-center">
                <ChefHat size={28} className="text-white opacity-50" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-1">
              Last cooked
            </p>
            <p className="font-semibold text-gray-900 dark:text-stone-50 text-base leading-snug line-clamp-2">
              {entry.recipeTitle}
            </p>
            <p className="text-sm text-warm-400 dark:text-stone-500 mt-1">
              {isMe ? myName : partnerName} · {timeAgo(entry.date)}
            </p>
          </div>
          <ArrowRight size={16} className="text-warm-300 dark:text-stone-600 flex-shrink-0" />
        </div>
      </div>
    </Link>
  )
}

function TonightCard({ recipe, navigate }) {
  if (!recipe) {
    return (
      <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <CalendarDays size={18} className="text-indigo-500" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-stone-50 text-base">Tonight's dinner</p>
        </div>
        <p className="text-warm-400 dark:text-stone-500 text-sm mb-4">Nothing planned yet — what sounds good?</p>
        <button
          onClick={() => navigate('/recipes')}
          className="w-full py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          Browse recipes
          <ArrowRight size={15} />
        </button>
      </div>
    )
  }

  return (
    <Link to={`/recipe/${recipe.id}`} className="block">
      <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-card overflow-hidden active:scale-[0.98] transition-transform">
        <div className="relative h-36">
          {recipe.thumbnail_url ? (
            <img src={recipe.thumbnail_url} alt={recipe.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-300 to-violet-500 flex items-center justify-center">
              <ChefHat size={40} className="text-white opacity-40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-indigo-500 rounded-full px-2.5 py-1">
            <CalendarDays size={11} className="text-white" />
            <span className="text-white text-[11px] font-semibold">Tonight's dinner</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="font-display font-semibold text-white text-lg leading-tight">{recipe.title}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}

function WeatherCard({ weather, suggestion }) {
  if (!suggestion) return null
  const { label, recipe } = suggestion
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{weather.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 dark:text-stone-50 text-base">
            {weather.temp}° · {weather.city?.split(',')[0]}
          </p>
          <p className="text-warm-400 dark:text-stone-500 text-sm mt-0.5 leading-snug">{label}</p>
        </div>
      </div>

      <Link to={`/recipe/${recipe.id}`}>
        <div className="flex items-center gap-3 p-3 bg-warm-50 dark:bg-stone-700/60 rounded-2xl active:scale-[0.98] transition-transform">
          {recipe.thumbnail_url ? (
            <img src={recipe.thumbnail_url} alt={recipe.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" loading="lazy" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
              <ChefHat size={20} className="text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-stone-50 truncate">{recipe.title}</p>
            {totalTime > 0 && (
              <p className="text-xs text-warm-400 dark:text-stone-500 mt-0.5">{totalTime} min</p>
            )}
          </div>
          <ArrowRight size={15} className="text-warm-300 dark:text-stone-600 flex-shrink-0" />
        </div>
      </Link>
    </div>
  )
}

function DiscoverySection({ recipes, navigate }) {
  const [active, setActive] = useState(null)

  const handleSurprise = () => {
    if (!recipes.length) return
    const r = recipes[Math.floor(Math.random() * recipes.length)]
    navigate(`/recipe/${r.id}`)
  }

  const filtered = active
    ? recipes.filter(active.filter)
    : []

  return (
    <div>
      <p className="text-[11px] font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-3">
        Discover something new
      </p>

      {/* Chips */}
      <div className="flex gap-2 mb-4">
        {/* Surprise Me — always navigates */}
        <button
          onClick={handleSurprise}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 whitespace-nowrap transition-all active:scale-95"
        >
          <Shuffle size={12} />
          Surprise Me
        </button>

        {DISCOVERY_CHIPS.map(({ label, icon: Icon, color, filter }) => (
          <button
            key={label}
            onClick={() => setActive(active?.label === label ? null : { label, filter })}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
              active?.label === label ? 'bg-primary text-white shadow-soft' : color
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Results */}
      {active && (
        filtered.length === 0 ? (
          <p className="text-sm text-warm-400 dark:text-stone-500 text-center py-4">
            No recipes match this filter yet.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-5 px-5">
            {filtered.map((recipe) => (
              <MiniRecipeCard key={recipe.id} recipe={recipe} />
            ))}
            <Link
              to={`/recipes`}
              className="flex-shrink-0 w-32 flex flex-col items-center justify-center gap-2 bg-white dark:bg-stone-800 rounded-2xl shadow-card text-primary text-xs font-semibold p-4 active:scale-95 transition-all"
            >
              See all
              <ArrowRight size={16} />
            </Link>
          </div>
        )
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { partner } = usePartner()
  const { data: recipes = [] } = useRecipes()
  const { weather } = useWeather()
  const { darkMode, setDarkMode, mealPlan } = useAppStore()
  const { entries, myId, partnerId, cookDates } = useCookLog()
  const streak = calculateStreak(cookDates)

  const myName = profile?.display_name || 'You'
  const partnerName = partner?.display_name || 'Partner'

  const myCooks      = entries.filter((e) => e.userId === myId).length
  const partnerCooks = entries.filter((e) => e.userId === partnerId).length
  const lastEntry    = entries[0] ?? null

  const today = new Date().toISOString().split('T')[0]
  const tonightRecipeId = mealPlan[today]
  const tonightRecipe = tonightRecipeId ? recipes.find((r) => r.id === tonightRecipeId) : null

  const weatherSuggestion = getWeatherSuggestion(weather, recipes)

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <PageHeader
        right={
          <>
            {weather && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-stone-800 rounded-full px-3 py-1.5 shadow-card">
                <span className="text-sm leading-none">{weather.emoji}</span>
                <span className="text-xs font-bold text-gray-800 dark:text-stone-100">{weather.temp}°</span>
                <span className="text-[10px] text-warm-400 dark:text-stone-500">
                  {weather.city?.split(',')[0]}
                </span>
              </div>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card active:scale-90 transition-transform"
            >
              {darkMode
                ? <Sun size={16} className="text-amber-400" />
                : <Moon size={16} className="text-stone-500" />
              }
            </button>
          </>
        }
      />

      {/* Greeting */}
      <div className="px-5 pb-5">
        <p className="text-warm-400 dark:text-stone-500 text-sm font-medium">{getGreeting()}</p>
        <div className="flex items-end justify-between">
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-stone-50">
            {myName} & {partnerName}
          </h1>
          <p className="text-warm-400 dark:text-stone-500 text-xs font-medium mb-0.5">
            {new Date().toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="px-5 space-y-4 pb-8">
        <StreakCard streak={streak} myName={myName} partnerName={partnerName} />

        <VsCard jacobCooks={myCooks} madiCooks={partnerCooks} myName={myName} partnerName={partnerName} />

        {lastEntry && (
          <LastCookedCard entry={lastEntry} myId={myId} myName={myName} partnerName={partnerName} />
        )}

        <TonightCard recipe={tonightRecipe} navigate={navigate} />

        {weather && (
          <WeatherCard weather={weather} suggestion={weatherSuggestion} />
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4 text-center">
            <p className="font-bold text-2xl text-gray-900 dark:text-stone-50">{recipes.length}</p>
            <p className="text-[11px] text-warm-400 dark:text-stone-500 mt-0.5">Recipes</p>
          </div>
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4 text-center">
            <p className="font-bold text-2xl text-gray-900 dark:text-stone-50">{entries.length}</p>
            <p className="text-[11px] text-warm-400 dark:text-stone-500 mt-0.5">Times cooked</p>
          </div>
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4 text-center">
            <p className="font-bold text-2xl text-gray-900 dark:text-stone-50">{streak}</p>
            <p className="text-[11px] text-warm-400 dark:text-stone-500 mt-0.5">Day streak</p>
          </div>
        </div>

        {/* Recent activity */}
        {entries.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-3">Recent activity</p>
            <div className="space-y-2">
              {entries.slice(0, 4).map((entry) => {
                const isMe = entry.userId === myId
                const name = isMe ? myName : partnerName
                return (
                  <Link key={entry.id} to={`/recipe/${entry.recipeId}`} className="flex items-center gap-3 bg-white dark:bg-stone-800 rounded-2xl shadow-card p-3 active:scale-[0.98] transition-transform">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-warm-100 dark:bg-stone-700">
                      {entry.recipeThumbnail
                        ? <img src={entry.recipeThumbnail} alt={entry.recipeTitle} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><ChefHat size={16} className="text-warm-300" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-stone-50 truncate">{entry.recipeTitle}</p>
                      <p className="text-xs text-warm-400 dark:text-stone-500 mt-0.5">
                        {name} · {timeAgo(entry.date)}
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-primary' : 'bg-sage'}`}>
                      <span className="text-white text-[9px] font-bold">{name[0]}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        <DiscoverySection recipes={recipes} navigate={navigate} />
      </div>
    </div>
  )
}
