import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Clock, Users, Star, ChefHat, ShoppingCart,
  Minus, Plus, Trash2, Check, Share2, Play, Pencil
} from 'lucide-react'
import { useRecipe, useLogMadeIt, useDeleteRecipe, useSimilarRecipes } from '../hooks/useRecipes'
import { useGrocery } from '../hooks/useGrocery'
import { useAppStore } from '../stores/useAppStore'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: recipe, isLoading } = useRecipe(id)
  const logMadeIt = useLogMadeIt()
  const deleteRecipe = useDeleteRecipe()
  const { logCook, incrementGroceryListsGenerated } = useAppStore()
  const { profile } = useAuth()
  const { addItems } = useGrocery()

  const similarRecipes = useSimilarRecipes(recipe)

  const [servingScale, setServingScale] = useState(1)
  const [showMadeItModal, setShowMadeItModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (isLoading) return <DetailSkeleton />
  if (!recipe) return (
    <div className="min-h-screen bg-cream dark:bg-stone-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-3">🍽️</p>
        <p className="font-semibold text-gray-700 dark:text-stone-200">Recipe not found</p>
        <Link to="/" className="text-primary text-sm font-semibold mt-2 block">Back to home</Link>
      </div>
    </div>
  )

  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)

  const handleMadeItSave = async ({ rating, notes, person }) => {
    try {
      await logMadeIt.mutateAsync({ recipeId: recipe.id, rating, notes })
      logCook({ person, recipeId: recipe.id, recipeTitle: recipe.title, recipeThumbnail: recipe.thumbnail_url })
      setShowMadeItModal(false)
      toast.success('Logged! Great cooking 🎉')
    } catch {
      toast.error('Failed to log')
    }
  }

  const handleAddToGrocery = async () => {
    const scaled = (recipe.ingredients || []).map((ing) => ({
      ...ing,
      amount: scaleAmount(ing.amount) || ing.amount,
    }))
    await addItems(scaled)
    incrementGroceryListsGenerated()
    const scaleLabel = servingScale !== 1 ? ` (×${servingScale})` : ''
    toast.success(`${scaled.length} items added to grocery list${scaleLabel}`)
  }

  const handleShare = async () => {
    const shareData = {
      title: recipe.title,
      text: recipe.description ? `${recipe.description}\n\nFrom Plated 🍽️` : `Check out this recipe: ${recipe.title}`,
      url: window.location.href,
    }
    if (navigator.share) {
      try { await navigator.share(shareData) }
      catch (err) { if (err.name !== 'AbortError') toast.error('Could not share') }
    } else {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied to clipboard')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteRecipe.mutateAsync(recipe.id)
      toast.success('Recipe deleted')
      navigate('/')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const scaleAmount = (amount) => {
    if (!amount || servingScale === 1) return amount
    const num = parseFloat(amount)
    if (isNaN(num)) return amount
    const scaled = num * servingScale
    return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1)
  }

  const hasSteps = recipe.steps?.length > 0

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      {/* Hero */}
      <div className="relative h-72">
        {recipe.thumbnail_url ? (
          <img src={recipe.thumbnail_url} alt={recipe.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-300 to-primary-600 flex items-center justify-center">
            <ChefHat size={72} className="text-white opacity-30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        <button
          onClick={() => navigate(-1)}
          className="absolute top-14 left-5 w-9 h-9 bg-white/90 dark:bg-stone-900/90 rounded-full flex items-center justify-center shadow-soft backdrop-blur-sm"
        >
          <ArrowLeft size={18} className="text-gray-800 dark:text-stone-100" />
        </button>

        <div className="absolute top-14 right-5 flex gap-2">
          <button
            onClick={handleShare}
            className="w-9 h-9 bg-white/90 dark:bg-stone-900/90 rounded-full flex items-center justify-center shadow-soft backdrop-blur-sm"
          >
            <Share2 size={15} className="text-gray-800 dark:text-stone-100" />
          </button>
          <button
            onClick={() => navigate(`/recipe/${recipe.id}/edit`)}
            className="w-9 h-9 bg-white/90 dark:bg-stone-900/90 rounded-full flex items-center justify-center shadow-soft backdrop-blur-sm"
          >
            <Pencil size={15} className="text-gray-800 dark:text-stone-100" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-9 h-9 bg-white/90 dark:bg-stone-900/90 rounded-full flex items-center justify-center shadow-soft backdrop-blur-sm"
          >
            <Trash2 size={15} className="text-rose-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 -mt-6 relative">
        <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-soft p-5 mb-4">
          {recipe.tags?.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {recipe.tags.map((tag) => (
                <span key={tag} className="text-[11px] font-semibold text-primary bg-primary-50 dark:bg-primary-900/30 rounded-full px-2.5 py-0.5 capitalize">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-stone-50 leading-tight mb-1">
            {recipe.title}
          </h1>

          {recipe.description && (
            <p className="text-warm-400 dark:text-stone-400 text-sm leading-relaxed mb-3">{recipe.description}</p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 py-3 border-t border-b border-warm-100 dark:border-stone-700">
            {totalTime > 0 && (
              <div className="text-center">
                <Clock size={16} className="text-primary mx-auto mb-1" />
                <p className="text-xs font-bold text-gray-900 dark:text-stone-50">{totalTime} min</p>
                <p className="text-[10px] text-warm-400 dark:text-stone-500">Total time</p>
              </div>
            )}
            {recipe.servings && (
              <div className="text-center">
                <Users size={16} className="text-primary mx-auto mb-1" />
                <p className="text-xs font-bold text-gray-900 dark:text-stone-50">{Math.round(recipe.servings * servingScale)}</p>
                <p className="text-[10px] text-warm-400 dark:text-stone-500">Servings</p>
              </div>
            )}
            {recipe.rating && (
              <div className="text-center">
                <Star size={16} className="text-amber-400 fill-amber-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-gray-900 dark:text-stone-50">{recipe.rating}/5</p>
                <p className="text-[10px] text-warm-400 dark:text-stone-500">Rating</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowMadeItModal(true)}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-soft"
            >
              <ChefHat size={15} />
              Made It
            </button>
            <button
              onClick={handleAddToGrocery}
              className="flex-1 py-2.5 bg-warm-100 dark:bg-stone-700 text-gray-700 dark:text-stone-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <ShoppingCart size={15} />
              Grocery List
            </button>
          </div>

          {hasSteps && (
            <button
              onClick={() => navigate(`/recipe/${id}/cook`)}
              className="w-full mt-3 py-3 bg-sage text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-soft"
            >
              <Play size={15} fill="white" />
              Start Cooking
            </button>
          )}
        </div>

        {/* Ingredients */}
        {recipe.ingredients?.length > 0 && (
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-gray-900 dark:text-stone-50">Ingredients</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setServingScale(Math.max(0.5, servingScale - 0.5))}
                  className="w-7 h-7 bg-warm-100 dark:bg-stone-700 rounded-full flex items-center justify-center"
                >
                  <Minus size={13} className="text-gray-600 dark:text-stone-300" />
                </button>
                <span className="text-sm font-bold text-gray-900 dark:text-stone-50 w-8 text-center">{servingScale}×</span>
                <button
                  onClick={() => setServingScale(servingScale + 0.5)}
                  className="w-7 h-7 bg-warm-100 dark:bg-stone-700 rounded-full flex items-center justify-center"
                >
                  <Plus size={13} className="text-gray-600 dark:text-stone-300" />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-warm-50 dark:border-stone-700 last:border-0">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                  <span className="text-sm text-warm-400 dark:text-stone-400 font-medium min-w-[4rem]">{scaleAmount(ing.amount)}</span>
                  <span className="text-sm text-gray-900 dark:text-stone-100 flex-1">{ing.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        {recipe.steps?.length > 0 && (
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-gray-900 dark:text-stone-50">Instructions</h2>
              <button
                onClick={() => navigate(`/recipe/${id}/cook`)}
                className="text-xs text-sage font-semibold flex items-center gap-1"
              >
                <Play size={11} fill="currentColor" />
                Cook mode
              </button>
            </div>
            <div className="space-y-4">
              {recipe.steps.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-7 h-7 bg-warm-100 dark:bg-stone-700 text-gray-600 dark:text-stone-300 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-700 dark:text-stone-300 leading-relaxed flex-1">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {recipe.source_url && (
          <div className="mb-4">
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4 text-center"
            >
              <p className="text-xs text-warm-400 dark:text-stone-500 mb-1">Original source</p>
              <p className="text-sm text-primary font-semibold truncate">
                {(() => { try { return new URL(recipe.source_url).hostname.replace('www.', '') } catch { return recipe.source_url } })()}
              </p>
            </a>
          </div>
        )}

        {/* Similar Recipes */}
        {similarRecipes.length > 0 && (
          <div className="mb-6">
            <h2 className="font-display font-semibold text-lg text-gray-900 dark:text-stone-50 mb-3">
              You might also like
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
              {similarRecipes.map((r) => (
                <Link
                  key={r.id}
                  to={`/recipe/${r.id}`}
                  className="flex-shrink-0 w-36 bg-white dark:bg-stone-800 rounded-2xl shadow-card overflow-hidden active:scale-95 transition-transform"
                >
                  <div className="h-24 bg-warm-100 dark:bg-stone-700 overflow-hidden">
                    {r.thumbnail_url ? (
                      <img src={r.thumbnail_url} alt={r.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ChefHat size={28} className="text-warm-300 dark:text-stone-600" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-gray-900 dark:text-stone-50 leading-tight line-clamp-2">{r.title}</p>
                    {((r.prep_time || 0) + (r.cook_time || 0)) > 0 && (
                      <p className="text-[10px] text-warm-400 dark:text-stone-500 mt-1 flex items-center gap-1">
                        <Clock size={9} />
                        {(r.prep_time || 0) + (r.cook_time || 0)} min
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Made It Modal */}
      {showMadeItModal && (
        <MadeItModal
          recipe={recipe}
          onClose={() => setShowMadeItModal(false)}
          onSave={handleMadeItSave}
          saving={logMadeIt.isPending}
          currentUser={profile?.display_name?.toLowerCase() === 'madi' ? 'madi' : 'jacob'}
        />
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50 px-4 pb-nav" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 w-full mb-2" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 dark:text-stone-50 text-lg mb-2">Delete recipe?</h3>
            <p className="text-warm-400 dark:text-stone-400 text-sm mb-5">
              This will permanently remove "{recipe.title}" from your collection.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-warm-100 dark:bg-stone-700 text-gray-700 dark:text-stone-200 rounded-xl font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-semibold text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MadeItModal({ recipe, onClose, onSave, saving, currentUser = 'jacob' }) {
  const [person, setPerson] = useState(currentUser)
  const [rating, setRating] = useState(recipe.rating || 0)
  const [hovered, setHovered] = useState(0)
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    if (!rating) return toast.error('Add a star rating first')
    onSave({ rating, notes: notes.trim() || null, person })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-stone-800 rounded-t-3xl p-6 w-full animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-warm-200 dark:bg-stone-600 rounded-full mx-auto mb-5" />
        <h3 className="font-display font-bold text-xl text-gray-900 dark:text-stone-50 mb-1">Nice work! 🎉</h3>
        <p className="text-warm-400 dark:text-stone-400 text-sm mb-5">
          How did <span className="font-medium text-gray-700 dark:text-stone-200">{recipe.title}</span> turn out?
        </p>

        {/* Who cooked? */}
        <p className="text-[11px] font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-2">Who cooked?</p>
        <div className="flex gap-2 mb-5">
          {[['jacob', 'Jacob 👨‍🍳'], ['madi', 'Madi 👩‍🍳']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPerson(val)}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                person === val
                  ? val === 'jacob' ? 'bg-primary text-white' : 'bg-sage text-white'
                  : 'bg-warm-100 dark:bg-stone-700 text-gray-700 dark:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Stars */}
        <div className="flex gap-3 justify-center mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="transition-transform active:scale-90"
            >
              <Star
                size={34}
                className={`transition-colors ${
                  star <= (hovered || rating) ? 'text-amber-400 fill-amber-400' : 'text-warm-200 dark:text-stone-600'
                }`}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="text-center text-sm font-semibold text-gray-700 dark:text-stone-200 mb-4">
            {['', 'Not our best', 'Pretty good', 'Really liked it', 'Loved it', 'Perfect — make again!'][rating]}
          </p>
        )}

        <div className="mb-5">
          <textarea
            placeholder="Any notes? (optional) — what you'd change, what worked great…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full p-3.5 bg-warm-100 dark:bg-stone-700 rounded-2xl text-sm text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 outline-none resize-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 bg-warm-100 dark:bg-stone-700 text-gray-700 dark:text-stone-200 rounded-2xl font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !rating}
            className="flex-1 py-3.5 bg-primary text-white rounded-2xl font-semibold text-sm shadow-soft disabled:opacity-60 active:scale-95 transition-all"
          >
            {saving ? 'Saving…' : 'Log it'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <div className="h-72 bg-warm-200 dark:bg-stone-800 animate-pulse" />
      <div className="px-5 -mt-6">
        <div className="bg-white dark:bg-stone-800 rounded-3xl p-5 shadow-soft">
          <div className="h-6 bg-warm-200 dark:bg-stone-700 rounded animate-pulse mb-3 w-1/2" />
          <div className="h-8 bg-warm-200 dark:bg-stone-700 rounded animate-pulse mb-2" />
          <div className="h-4 bg-warm-200 dark:bg-stone-700 rounded animate-pulse w-3/4" />
        </div>
      </div>
    </div>
  )
}
