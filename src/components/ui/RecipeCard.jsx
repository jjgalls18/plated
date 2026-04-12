import { Link } from 'react-router-dom'
import { Clock, Star, ChefHat } from 'lucide-react'

function getGradient(title = '') {
  const gradients = [
    'from-orange-400 to-rose-500',
    'from-amber-400 to-orange-600',
    'from-emerald-400 to-teal-600',
    'from-rose-400 to-pink-600',
    'from-violet-400 to-purple-600',
    'from-sky-400 to-blue-600',
    'from-yellow-400 to-amber-600',
    'from-teal-400 to-cyan-600',
  ]
  const index = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % gradients.length
  return gradients[index]
}

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={10}
          className={star <= (rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-warm-300 dark:text-stone-600'}
        />
      ))}
    </div>
  )
}

export default function RecipeCard({ recipe }) {
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)
  const gradient = getGradient(recipe.title)

  return (
    <Link to={`/recipe/${recipe.id}`} className="block">
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card overflow-hidden hover:shadow-card-hover transition-shadow duration-300 active:scale-[0.98] transition-transform">
        <div className="relative h-44 overflow-hidden">
          {recipe.thumbnail_url ? (
            <img
              src={recipe.thumbnail_url}
              alt={recipe.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <ChefHat size={48} className="text-white opacity-40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {recipe.made_count > 0 && (
            <div className="absolute top-3 right-3 bg-white/90 dark:bg-stone-900/90 rounded-full px-2.5 py-1 flex items-center gap-1">
              <ChefHat size={11} className="text-primary" />
              <span className="text-[11px] font-semibold text-gray-800 dark:text-stone-100">{recipe.made_count}×</span>
            </div>
          )}
          {totalTime > 0 && (
            <div className="absolute bottom-3 left-3 bg-black/50 rounded-full px-2.5 py-1 flex items-center gap-1">
              <Clock size={11} className="text-white" />
              <span className="text-[11px] font-medium text-white">{totalTime} min</span>
            </div>
          )}
        </div>
        <div className="p-3.5">
          <h3 className="font-semibold text-gray-900 dark:text-stone-50 text-sm leading-snug line-clamp-2 mb-1.5">
            {recipe.title}
          </h3>
          <div className="flex items-center justify-between">
            <StarRating rating={recipe.rating} />
            {recipe.tags?.length > 0 && (
              <span className="text-[11px] text-warm-400 dark:text-stone-500 font-medium capitalize">
                {recipe.tags[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export function RecipeCardHero({ recipe }) {
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)

  return (
    <Link to={`/recipe/${recipe.id}`} className="block">
      <div className="relative h-64 rounded-3xl overflow-hidden shadow-soft active:scale-[0.98] transition-transform">
        {recipe.thumbnail_url ? (
          <img src={recipe.thumbnail_url} alt={recipe.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${getGradient(recipe.title)} flex items-center justify-center`}>
            <ChefHat size={64} className="text-white opacity-30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          {recipe.tags?.length > 0 && (
            <div className="flex gap-2 mb-2">
              {recipe.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-[11px] font-medium text-white/80 bg-white/20 rounded-full px-2.5 py-0.5 capitalize">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h2 className="font-display font-semibold text-xl text-white leading-tight line-clamp-2 mb-2">
            {recipe.title}
          </h2>
          <div className="flex items-center gap-3">
            {totalTime > 0 && (
              <div className="flex items-center gap-1">
                <Clock size={13} className="text-white/70" />
                <span className="text-xs text-white/80 font-medium">{totalTime} min</span>
              </div>
            )}
            {recipe.made_count > 0 && (
              <div className="flex items-center gap-1">
                <ChefHat size={13} className="text-white/70" />
                <span className="text-xs text-white/80 font-medium">Made {recipe.made_count}×</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export function RecipeCardSkeleton() {
  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card overflow-hidden">
      <div className="h-44 bg-warm-200 dark:bg-stone-700 animate-pulse" />
      <div className="p-3.5">
        <div className="h-4 bg-warm-200 dark:bg-stone-700 rounded animate-pulse mb-2 w-3/4" />
        <div className="h-3 bg-warm-200 dark:bg-stone-700 rounded animate-pulse w-1/2" />
      </div>
    </div>
  )
}
