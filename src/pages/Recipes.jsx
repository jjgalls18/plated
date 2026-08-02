import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, X, Plus, Shuffle, BookHeart } from 'lucide-react'
import { useRecipes } from '../hooks/useRecipes'
import RecipeCard, { RecipeCardHero, RecipeCardSkeleton } from '../components/ui/RecipeCard'
import PageHeader from '../components/ui/PageHeader'

const FILTER_TAGS = [
  'italian', 'asian', 'healthy', 'quick', 'dessert',
  'pasta', 'seafood', 'vegetarian', 'date night', 'weeknight',
]

function tagFromFilter(f) {
  if (!f) return null
  if (f === 'date-night') return 'date night'
  if (f === 'under-30') return 'quick'
  if (f === 'low-effort') return 'quick'
  return f
}

export default function Recipes() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState(() => tagFromFilter(searchParams.get('filter')))
  const [view, setView] = useState('all') // 'all' | 'cookbook'

  const { data: recipes = [], isLoading } = useRecipes(query)

  const favorites = recipes.filter((r) => r.is_favorite)
  const displayed = view === 'cookbook'
    ? favorites
    : activeTag
      ? recipes.filter((r) => r.tags?.includes(activeTag))
      : recipes

  const handleSurprise = () => {
    if (!recipes.length) return
    const r = recipes[Math.floor(Math.random() * recipes.length)]
    navigate(`/recipe/${r.id}`)
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <PageHeader
        right={
          <>
            <button
              onClick={handleSurprise}
              title="Surprise me"
              className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card active:scale-90 transition-transform"
            >
              <Shuffle size={16} className="text-primary" />
            </button>
            <Link
              to="/add"
              className="w-9 h-9 bg-primary rounded-full flex items-center justify-center shadow-soft active:scale-90 transition-transform"
            >
              <Plus size={18} className="text-white" />
            </Link>
          </>
        }
      />

      {/* Title + search */}
      <div className="px-5 pt-3 pb-4">
        <div className="mb-4">
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-stone-50">Recipes</h1>
          {!isLoading && (
            <p className="text-warm-400 dark:text-stone-500 text-sm mt-0.5">
              {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} saved
            </p>
          )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <SearchIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500" />
          <input
            type="search"
            placeholder="Search recipes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3.5 bg-white dark:bg-stone-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 shadow-card outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* All / Our Cookbook */}
      <div className="px-5 mb-5">
        <div className="flex bg-white dark:bg-stone-800 rounded-2xl shadow-card p-1">
          {[['all', 'All Recipes'], ['cookbook', `Our Cookbook${favorites.length ? ` (${favorites.length})` : ''}`]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                view === key ? 'bg-primary text-white shadow-soft' : 'text-warm-400 dark:text-stone-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter tags */}
      {view === 'all' && (
        <div className="px-5 mb-5">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {FILTER_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 capitalize ${
                  activeTag === tag
                    ? 'bg-primary text-white shadow-soft'
                    : 'bg-white dark:bg-stone-800 text-warm-400 dark:text-stone-400 shadow-card'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="px-5 pb-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <RecipeCardSkeleton key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          view === 'cookbook' ? (
            <div className="text-center py-16">
              <BookHeart size={36} className="text-warm-300 dark:text-stone-600 mx-auto mb-3" />
              <p className="font-semibold text-gray-700 dark:text-stone-200 mb-1">Nothing favorited yet</p>
              <p className="text-warm-400 dark:text-stone-500 text-sm">Tap the heart on any recipe to add it to your cookbook.</p>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-semibold text-gray-700 dark:text-stone-200 mb-1">No results</p>
              <p className="text-warm-400 dark:text-stone-500 text-sm">
                {query ? `Nothing matched "${query}"` : 'Try a different filter'}
              </p>
              {recipes.length === 0 && (
                <Link
                  to="/add"
                  className="inline-flex items-center gap-2 mt-4 bg-primary text-white font-semibold px-5 py-2.5 rounded-2xl text-sm shadow-soft"
                >
                  <Plus size={15} />
                  Add your first recipe
                </Link>
              )}
            </div>
          )
        ) : view === 'cookbook' ? (
          <div className="space-y-4">
            {displayed.map((recipe) => (
              <RecipeCardHero key={recipe.id} recipe={recipe} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {displayed.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
