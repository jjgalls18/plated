import { useState } from 'react'
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes'
import RecipeCard, { RecipeCardSkeleton } from '../components/ui/RecipeCard'

const FILTER_TAGS = ['italian', 'asian', 'healthy', 'quick', 'dessert', 'pasta', 'seafood', 'vegetarian', 'date night']

export default function Search() {
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const { data: recipes = [], isLoading } = useRecipes(query)

  const displayed = activeTag
    ? recipes.filter((r) => r.tags?.includes(activeTag))
    : recipes

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/" className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card">
            <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
          </Link>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-stone-50">Search</h1>
        </div>

        <div className="relative">
          <SearchIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500" />
          <input
            type="search"
            placeholder="Search recipes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-11 pr-10 py-3.5 bg-white dark:bg-stone-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 shadow-card outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filter tags */}
      <div className="px-5 mb-5">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {FILTER_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 capitalize ${
                activeTag === tag
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-stone-800 text-warm-400 dark:text-stone-400 shadow-card hover:text-primary dark:hover:text-primary'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <RecipeCardSkeleton key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold text-gray-700 dark:text-stone-200 mb-1">No results</p>
            <p className="text-warm-400 dark:text-stone-500 text-sm">
              {query ? `Nothing matched "${query}"` : 'Try a different filter'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-warm-400 dark:text-stone-500 font-medium mb-3">
              {displayed.length} recipe{displayed.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {displayed.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
