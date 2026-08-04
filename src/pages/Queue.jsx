import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, RefreshCw, Trash2, Play, ChefHat, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useVideoQueue } from '../hooks/useVideoQueue'
import { useCobaltStatus } from '../hooks/useCobaltStatus'
import { useAppStore } from '../stores/useAppStore'
import { useAddRecipe, useRecipes } from '../hooks/useRecipes'
import { transcribeVideoAudio, extractRecipeFromText, mergeQueuedRecipe, errorText } from '../lib/extraction'
import toast from 'react-hot-toast'

const STATUS_META = {
  queued: { label: 'Queued', color: 'bg-warm-100 dark:bg-stone-700 text-warm-500 dark:text-stone-400' },
  partial: { label: 'Partial recipe — full extraction pending', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  processing: { label: 'Processing…', color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' },
  complete: { label: 'Complete', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  failed: { label: 'Failed', color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' },
}

export default function Queue() {
  const navigate = useNavigate()
  const { items, updateQueueItem, removeFromQueue } = useVideoQueue()
  const { reachable, checking, refresh } = useCobaltStatus()
  const { anthropicApiKey, openaiApiKey, logAiCost } = useAppStore()
  const { data: savedRecipes = [] } = useRecipes()
  const addRecipe = useAddRecipe()
  const [processingId, setProcessingId] = useState(null)

  const pending = items.filter((i) => i.status === 'queued' || i.status === 'partial')
  const finished = items.filter((i) => i.status === 'complete' || i.status === 'failed')

  const processItem = async (item) => {
    if (!reachable) return toast.error('Home server is still unreachable')
    if (!anthropicApiKey || !openaiApiKey) return toast.error('Need both an Anthropic and OpenAI key to process video (tap logo 5×)')

    setProcessingId(item.id)
    await updateQueueItem(item.id, { status: 'processing' })

    try {
      const transcript = await transcribeVideoAudio(item.url, { openaiApiKey, onStep: () => {} })

      const recipe = item.partial_recipe
        ? await mergeQueuedRecipe({ partialRecipe: item.partial_recipe, transcript, sourceUrl: item.url, anthropicApiKey, logAiCost })
        : await extractRecipeFromText(transcript, anthropicApiKey, item.url, savedRecipes, { model: 'claude-sonnet-5', feature: 'video_extraction', logAiCost })

      const saved = await addRecipe.mutateAsync({
        title: recipe.title,
        description: recipe.description || '',
        source_url: item.url,
        thumbnail_url: recipe.thumbnail_url || null,
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || [],
        tags: recipe.tags || [],
        prep_time: recipe.prep_time || null,
        cook_time: recipe.cook_time || null,
        servings: recipe.servings || null,
      })

      await updateQueueItem(item.id, { status: 'complete', transcript_text: transcript, final_recipe_id: saved.id })
      toast.success('Recipe saved!')
      navigate(`/recipe/${saved.id}`)
    } catch (err) {
      if (err.cobaltUnreachable) {
        refresh()
        await updateQueueItem(item.id, { status: item.partial_recipe ? 'partial' : 'queued' })
        toast.error('Home server went offline mid-process — still queued')
      } else {
        await updateQueueItem(item.id, { status: 'failed', error_message: errorText(err.message, 'Processing failed') })
        toast.error(err.message || 'Processing failed')
      }
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <div className="px-5 pt-14 pb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card">
          <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-stone-50">Queue</h1>
          <p className="text-warm-400 dark:text-stone-500 text-xs mt-0.5">Videos waiting on the home server</p>
        </div>
        <button
          onClick={() => refresh()}
          className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card"
        >
          <RefreshCw size={15} className={`text-gray-700 dark:text-stone-300 ${checking ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-5 pb-nav space-y-3">
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl ${reachable ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${reachable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <p className={`text-xs font-semibold ${reachable ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
            {reachable ? 'Home server reachable' : 'Home server unreachable'}
          </p>
        </div>

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Clock size={32} className="text-warm-300 dark:text-stone-600 mb-3" />
            <p className="font-semibold text-gray-700 dark:text-stone-300 mb-1">Nothing queued</p>
            <p className="text-sm text-warm-400 dark:text-stone-500">Video links save here when the home server's unreachable</p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="space-y-2.5">
            {pending.map((item) => (
              <QueueCard
                key={item.id}
                item={item}
                reachable={reachable}
                processing={processingId === item.id}
                onProcess={() => processItem(item)}
                onRemove={() => removeFromQueue(item.id)}
              />
            ))}
          </div>
        )}

        {finished.length > 0 && (
          <div className="pt-2">
            <p className="text-[11px] font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-2">History</p>
            <div className="space-y-2.5">
              {finished.map((item) => (
                <QueueCard key={item.id} item={item} reachable={reachable} onRemove={() => removeFromQueue(item.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function QueueCard({ item, reachable, processing, onProcess, onRemove }) {
  const meta = STATUS_META[item.status] || STATUS_META.queued
  const title = item.partial_recipe?.title || item.url
  const canProcess = reachable && (item.status === 'queued' || item.status === 'partial')

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-warm-100 dark:bg-stone-700 flex items-center justify-center flex-shrink-0">
          {item.status === 'complete' ? <CheckCircle2 size={18} className="text-emerald-500" />
            : item.status === 'failed' ? <AlertTriangle size={18} className="text-rose-500" />
            : <ChefHat size={18} className="text-warm-400 dark:text-stone-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-stone-50 truncate">{title}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>
            {meta.label}
          </span>
          {item.status === 'failed' && item.error_message && (
            <p className="text-[11px] text-rose-500 mt-1">{item.error_message}</p>
          )}
        </div>
        <button onClick={onRemove} className="p-1.5 text-warm-300 dark:text-stone-600 hover:text-rose-400 transition-colors flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
      {canProcess && (
        <button
          onClick={onProcess}
          disabled={processing}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold active:scale-95 transition-all disabled:opacity-60"
        >
          {processing ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
          {processing ? 'Processing…' : 'Process now'}
        </button>
      )}
    </div>
  )
}
