import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Link as LinkIcon, PenLine, Camera, Plus, X, ChevronRight, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import { useAddRecipe, useRecipes } from '../hooks/useRecipes'
import { useAppStore } from '../stores/useAppStore'
import { extractFromVideo, extractFromWeb, isVideoUrl } from '../lib/extraction'
import toast from 'react-hot-toast'

const MODES = [
  { id: 'url', icon: LinkIcon, label: 'Paste a link', description: 'TikTok, Instagram, YouTube, or any recipe site' },
  { id: 'manual', icon: PenLine, label: 'Type it out', description: 'Enter ingredients and steps manually' },
  { id: 'photo', icon: Camera, label: 'Snap a photo', description: 'Handwritten notes or cookbook page' },
]

export default function AddRecipe() {
  const navigate = useNavigate()
  const [mode, setMode] = useState(null)
  const addRecipe = useAddRecipe()

  if (!mode) return <ModeSelect onSelect={setMode} />
  if (mode === 'url') return <UrlMode onBack={() => setMode(null)} addRecipe={addRecipe} navigate={navigate} />
  if (mode === 'manual') return <ManualMode onBack={() => setMode(null)} addRecipe={addRecipe} navigate={navigate} />
  if (mode === 'photo') return <PhotoMode onBack={() => setMode(null)} addRecipe={addRecipe} navigate={navigate} />
  return null
}

function ModeSelect({ onSelect }) {
  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <div className="px-5 pt-14 pb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-stone-50 mb-1">Add Recipe</h1>
        <p className="text-warm-400 dark:text-stone-500 text-sm">How would you like to add it?</p>
      </div>
      <div className="px-5 space-y-3">
        {MODES.map(({ id, icon: Icon, label, description }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="w-full bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5 flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Icon size={22} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-stone-50 text-sm">{label}</p>
              <p className="text-warm-400 dark:text-stone-500 text-xs mt-0.5">{description}</p>
            </div>
            <ChevronRight size={18} className="text-warm-300 dark:text-stone-600 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── URL Mode ─────────────────────────────────────────────────────────────────

const STEPS_VIDEO = [
  { key: 'fetch', label: 'Fetching video audio…' },
  { key: 'transcribe', label: 'Transcribing with Whisper…' },
  { key: 'extract', label: 'Extracting recipe with Claude…' },
]

const STEPS_WEB = [
  { key: 'fetch', label: 'Fetching page…' },
  { key: 'extract', label: 'Extracting recipe with Claude…' },
]

function UrlMode({ onBack, addRecipe, navigate }) {
  const { anthropicApiKey, openaiApiKey } = useAppStore()
  const { data: savedRecipes = [] } = useRecipes()
  const [url, setUrl] = useState('')
  const [stage, setStage] = useState('input') // input | processing | review | error
  const [stepLabel, setStepLabel] = useState('')
  const [extracted, setExtracted] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const isVideo = isVideoUrl(url)
  const hasKeys = isVideo ? (anthropicApiKey && openaiApiKey) : !!anthropicApiKey

  const handleExtract = async () => {
    if (!url.trim()) return
    setStage('processing')
    setStepLabel('')
    try {
      let recipe
      if (isVideo) {
        recipe = await extractFromVideo(url, {
          anthropicApiKey,
          openaiApiKey,
          onStep: setStepLabel,
          savedRecipes,
        })
      } else {
        recipe = await extractFromWeb(url, {
          anthropicApiKey,
          onStep: setStepLabel,
          savedRecipes,
        })
      }
      setExtracted(recipe)
      setStage('review')
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong')
      setStage('error')
    }
  }

  const handleSave = async () => {
    if (!extracted) return
    setSaving(true)
    try {
      const recipe = await addRecipe.mutateAsync({
        title: extracted.title,
        description: extracted.description || '',
        source_url: extracted.source_url || url,
        thumbnail_url: extracted.thumbnail_url || null,
        ingredients: extracted.ingredients || [],
        steps: extracted.steps || [],
        tags: extracted.tags || [],
        prep_time: extracted.prep_time || null,
        cook_time: extracted.cook_time || null,
        servings: extracted.servings || null,
      })
      toast.success('Recipe saved!')
      navigate(`/recipe/${recipe.id}`)
    } catch (err) {
      toast.error(err.message || 'Failed to save')
      setSaving(false)
    }
  }

  if (stage === 'processing') {
    return <ProcessingScreen stepLabel={stepLabel} isVideo={isVideo} />
  }

  if (stage === 'review' && extracted) {
    return (
      <ReviewScreen
        extracted={extracted}
        onChange={setExtracted}
        onSave={handleSave}
        onBack={() => setStage('input')}
        saving={saving}
      />
    )
  }

  if (stage === 'error') {
    return (
      <div className="min-h-screen bg-cream dark:bg-stone-900 flex flex-col items-center justify-center px-5 text-center">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle size={32} className="text-rose-500" />
        </div>
        <h2 className="font-display font-bold text-xl text-gray-900 dark:text-stone-50 mb-2">Extraction failed</h2>
        <p className="text-warm-400 dark:text-stone-500 text-sm mb-6 max-w-xs">{errorMsg}</p>
        <button onClick={() => setStage('input')} className="px-6 py-3 bg-primary text-white rounded-2xl font-semibold text-sm active:scale-95 transition-all">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <div className="px-5 pt-14 pb-6 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card">
          <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-stone-50">Paste a link</h1>
          <p className="text-warm-400 dark:text-stone-500 text-xs mt-0.5">TikTok, Instagram, YouTube, or any recipe site</p>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* URL input */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <input
            type="url"
            placeholder="Paste URL here…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            className="w-full text-sm text-gray-900 dark:text-stone-100 placeholder-warm-400 dark:placeholder-stone-500 outline-none bg-transparent"
          />
        </div>

        {/* URL type indicator */}
        {url.length > 8 && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold ${
            isVideo
              ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400'
              : 'bg-primary-50 dark:bg-primary/20 text-primary'
          }`}>
            {isVideo ? '🎬 Video detected — will transcribe audio' : '🌐 Web page — will extract recipe text'}
          </div>
        )}

        {/* API key warning */}
        {url.length > 8 && !hasKeys && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4">
            <p className="text-amber-800 dark:text-amber-300 text-xs font-semibold mb-1">API keys needed</p>
            <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
              {isVideo
                ? 'Video extraction needs both an Anthropic key and an OpenAI key. Tap the Plated logo 5 times to open admin settings.'
                : 'Web extraction needs an Anthropic API key. Tap the Plated logo 5 times to open admin settings.'}
            </p>
          </div>
        )}

        {/* Extract button */}
        <button
          onClick={handleExtract}
          disabled={!url.trim() || !hasKeys}
          className="w-full py-4 bg-primary text-white font-bold rounded-2xl text-sm shadow-soft active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isVideo ? '🎬 Extract from video' : '✨ Extract recipe'}
        </button>

        {/* How it works */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
          <p className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-3">How it works</p>
          {isVideo || !url ? (
            <div className="space-y-2.5">
              {[
                { emoji: '🎬', text: 'Downloads the audio from your video' },
                { emoji: '🎙️', text: 'Transcribes speech with OpenAI Whisper' },
                { emoji: '🤖', text: 'Claude extracts ingredients & steps' },
                { emoji: '✏️', text: 'You review and edit before saving' },
              ].map(({ emoji, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="text-base">{emoji}</span>
                  <p className="text-xs text-warm-400 dark:text-stone-500">{text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {[
                { emoji: '🌐', text: 'Fetches the recipe page' },
                { emoji: '🤖', text: 'Claude extracts ingredients & steps' },
                { emoji: '✏️', text: 'You review and edit before saving' },
              ].map(({ emoji, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="text-base">{emoji}</span>
                  <p className="text-xs text-warm-400 dark:text-stone-500">{text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProcessingScreen({ stepLabel, isVideo }) {
  const steps = isVideo ? STEPS_VIDEO : STEPS_WEB
  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900 flex flex-col items-center justify-center px-5 text-center">
      <div className="w-20 h-20 bg-primary-50 dark:bg-primary/20 rounded-3xl flex items-center justify-center mb-6">
        <Loader2 size={36} className="text-primary animate-spin" />
      </div>
      <h2 className="font-display font-bold text-2xl text-gray-900 dark:text-stone-50 mb-2">
        {isVideo ? 'Extracting from video…' : 'Extracting recipe…'}
      </h2>
      <p className="text-warm-400 dark:text-stone-500 text-sm mb-8">{stepLabel || 'Starting up…'}</p>
      <div className="w-full max-w-xs space-y-3">
        {steps.map(({ label }) => {
          const done = stepLabel && steps.findIndex(s => s.label === stepLabel) > steps.findIndex(s => s.label === label)
          const active = stepLabel === label
          return (
            <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
              active ? 'bg-primary text-white' : done ? 'bg-primary-50 dark:bg-primary/20 text-primary' : 'bg-white dark:bg-stone-800 text-warm-300 dark:text-stone-600'
            }`}>
              {done ? <CheckCircle2 size={16} /> : active ? <Loader2 size={16} className="animate-spin" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
              <p className="text-xs font-semibold">{label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Review Screen ────────────────────────────────────────────────────────────

function ConfidenceBanner({ confidence }) {
  if (confidence >= 0.75) return null
  const isLow = confidence < 0.5
  return (
    <div className={`flex gap-3 p-4 rounded-2xl ${isLow ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40'}`}>
      <AlertTriangle size={16} className={`flex-shrink-0 mt-0.5 ${isLow ? 'text-rose-500' : 'text-amber-500'}`} />
      <div>
        <p className={`text-xs font-semibold mb-0.5 ${isLow ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>
          {isLow ? 'Low confidence — review carefully' : 'Some amounts estimated'}
        </p>
        <p className={`text-xs leading-relaxed ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {isLow
            ? 'The video may not have stated all measurements verbally. Amounts marked "(est.)" are Claude\'s best guess — double-check before cooking.'
            : 'A few quantities were unclear and have been estimated. Items marked "(est.)" may need adjusting.'}
        </p>
      </div>
    </div>
  )
}

function ReviewScreen({ extracted, onChange, onSave, onBack, saving }) {
  const [ingInput, setIngInput] = useState({ amount: '', name: '' })
  const [stepInput, setStepInput] = useState('')

  const addIngredient = () => {
    if (!ingInput.name.trim()) return
    onChange({ ...extracted, ingredients: [...extracted.ingredients, { ...ingInput }] })
    setIngInput({ amount: '', name: '' })
  }

  const addStep = () => {
    if (!stepInput.trim()) return
    onChange({ ...extracted, steps: [...extracted.steps, stepInput.trim()] })
    setStepInput('')
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900 pb-10">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card">
          <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-stone-50">Review Recipe</h1>
          <p className="text-xs text-warm-400 dark:text-stone-500 mt-0.5">Edit anything before saving</p>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Confidence banner */}
        <ConfidenceBanner confidence={extracted.confidence ?? 1} />

        {/* Title */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-2">Title</label>
          <input
            value={extracted.title || ''}
            onChange={(e) => onChange({ ...extracted, title: e.target.value })}
            className="w-full text-gray-900 dark:text-stone-50 font-semibold text-lg outline-none bg-transparent"
          />
        </div>

        {/* Description */}
        {extracted.description && (
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
            <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-2">Description</label>
            <textarea
              value={extracted.description}
              onChange={(e) => onChange({ ...extracted, description: e.target.value })}
              rows={2}
              className="w-full text-sm text-gray-900 dark:text-stone-100 outline-none resize-none bg-transparent"
            />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Prep (min)', key: 'prep_time' },
            { label: 'Cook (min)', key: 'cook_time' },
            { label: 'Servings', key: 'servings' },
          ].map(({ label, key }) => (
            <div key={key} className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-3.5">
              <label className="text-[10px] font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-1.5">{label}</label>
              <input
                type="number"
                value={extracted[key] || ''}
                onChange={(e) => onChange({ ...extracted, [key]: parseInt(e.target.value) || null })}
                className="w-full text-gray-900 dark:text-stone-50 font-bold text-lg outline-none bg-transparent"
              />
            </div>
          ))}
        </div>

        {/* Tags */}
        {extracted.tags?.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {extracted.tags.map((tag, i) => (
              <span key={i} className="flex items-center gap-1.5 bg-primary-50 dark:bg-primary/20 text-primary text-xs font-semibold px-3 py-1 rounded-full capitalize">
                {tag}
                <button onClick={() => onChange({ ...extracted, tags: extracted.tags.filter((_, j) => j !== i) })}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Ingredients */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-3">
            Ingredients ({extracted.ingredients?.length || 0})
          </label>
          <div className="space-y-2 mb-3">
            {extracted.ingredients?.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-warm-100 dark:border-stone-700 last:border-0">
                <span className="text-sm text-warm-400 dark:text-stone-500 font-medium min-w-[5rem]">{ing.amount}</span>
                <span className="text-sm text-gray-900 dark:text-stone-100 flex-1">{ing.name}</span>
                <button onClick={() => onChange({ ...extracted, ingredients: extracted.ingredients.filter((_, j) => j !== i) })}>
                  <X size={14} className="text-warm-300 dark:text-stone-600" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              placeholder="Amount"
              value={ingInput.amount}
              onChange={(e) => setIngInput({ ...ingInput, amount: e.target.value })}
              className="w-20 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none text-gray-900 dark:text-stone-100"
            />
            <input
              placeholder="Ingredient"
              value={ingInput.name}
              onChange={(e) => setIngInput({ ...ingInput, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addIngredient()}
              className="flex-1 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none text-gray-900 dark:text-stone-100"
            />
            <button onClick={addIngredient} className="bg-primary text-white px-3 py-2 rounded-xl">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-3">
            Steps ({extracted.steps?.length || 0})
          </label>
          <div className="space-y-2.5 mb-3">
            {extracted.steps?.map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 h-6 bg-primary rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-gray-900 dark:text-stone-100 flex-1 leading-relaxed">{step}</p>
                <button onClick={() => onChange({ ...extracted, steps: extracted.steps.filter((_, j) => j !== i) })}>
                  <X size={14} className="text-warm-300 dark:text-stone-600" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              placeholder="Add a step…"
              value={stepInput}
              onChange={(e) => setStepInput(e.target.value)}
              rows={2}
              className="flex-1 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none resize-none text-gray-900 dark:text-stone-100"
            />
            <button onClick={addStep} className="bg-primary text-white px-3 py-3 rounded-xl self-end">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={onSave}
          disabled={saving || !extracted.title?.trim()}
          className="w-full py-4 bg-primary text-white font-bold rounded-2xl text-base shadow-soft active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {saving ? 'Saving…' : '✓ Save Recipe'}
        </button>
      </div>
    </div>
  )
}

// ─── Manual Mode ──────────────────────────────────────────────────────────────

function ManualMode({ onBack, addRecipe, navigate }) {
  const [form, setForm] = useState({
    title: '', description: '', prep_time: '', cook_time: '', servings: '4',
    tags: [], ingredients: [], steps: [],
  })
  const [ingInput, setIngInput] = useState({ amount: '', name: '' })
  const [stepInput, setStepInput] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [loading, setLoading] = useState(false)

  const addIngredient = () => {
    if (!ingInput.name.trim()) return
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { ...ingInput }] }))
    setIngInput({ amount: '', name: '' })
  }

  const addStep = () => {
    if (!stepInput.trim()) return
    setForm((f) => ({ ...f, steps: [...f.steps, stepInput.trim()] }))
    setStepInput('')
  }

  const addTag = () => {
    if (!tagInput.trim()) return
    setForm((f) => ({ ...f, tags: [...f.tags, tagInput.trim().toLowerCase()] }))
    setTagInput('')
  }

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Please add a title')
    setLoading(true)
    try {
      const recipe = await addRecipe.mutateAsync({
        ...form,
        prep_time: parseInt(form.prep_time) || null,
        cook_time: parseInt(form.cook_time) || null,
        servings: parseInt(form.servings) || 4,
      })
      toast.success('Recipe saved!')
      navigate(`/recipe/${recipe.id}`)
    } catch (err) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900 pb-8">
      <div className="px-5 pt-14 pb-6 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card">
          <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
        </button>
        <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-stone-50">New Recipe</h1>
      </div>

      <div className="px-5 space-y-4">
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-2">Title *</label>
          <input
            placeholder="What's cooking?"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full text-gray-900 dark:text-stone-50 font-semibold text-lg outline-none placeholder-warm-300 dark:placeholder-stone-600 bg-transparent"
          />
        </div>

        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-2">Description</label>
          <textarea
            placeholder="A short description…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full text-sm text-gray-900 dark:text-stone-100 outline-none placeholder-warm-300 dark:placeholder-stone-600 resize-none bg-transparent"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Prep (min)', key: 'prep_time', placeholder: '10' },
            { label: 'Cook (min)', key: 'cook_time', placeholder: '30' },
            { label: 'Servings', key: 'servings', placeholder: '4' },
          ].map(({ label, key, placeholder }) => (
            <div key={key} className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-3.5">
              <label className="text-[10px] font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-1.5">{label}</label>
              <input
                type="number"
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full text-gray-900 dark:text-stone-50 font-bold text-lg outline-none placeholder-warm-300 dark:placeholder-stone-600 bg-transparent"
              />
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-3">Tags</label>
          <div className="flex gap-2 flex-wrap mb-3">
            {form.tags.map((tag, i) => (
              <span key={i} className="flex items-center gap-1.5 bg-primary-50 dark:bg-primary/20 text-primary text-xs font-semibold px-3 py-1 rounded-full capitalize">
                {tag}
                <button onClick={() => setForm({ ...form, tags: form.tags.filter((_, j) => j !== i) })}><X size={11} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              placeholder="e.g. italian, quick, date night"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              className="flex-1 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none text-gray-900 dark:text-stone-100 placeholder-warm-400"
            />
            <button onClick={addTag} className="bg-primary text-white px-3 py-2 rounded-xl"><Plus size={16} /></button>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-3">Ingredients</label>
          <div className="space-y-2 mb-3">
            {form.ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-warm-100 dark:border-stone-700">
                <span className="text-sm text-warm-400 dark:text-stone-500 font-medium min-w-[4rem]">{ing.amount}</span>
                <span className="text-sm text-gray-900 dark:text-stone-100 flex-1">{ing.name}</span>
                <button onClick={() => setForm({ ...form, ingredients: form.ingredients.filter((_, j) => j !== i) })}><X size={14} className="text-warm-300" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input placeholder="Amount" value={ingInput.amount} onChange={(e) => setIngInput({ ...ingInput, amount: e.target.value })}
              className="w-20 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none text-gray-900 dark:text-stone-100 placeholder-warm-400" />
            <input placeholder="Ingredient" value={ingInput.name} onChange={(e) => setIngInput({ ...ingInput, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addIngredient()}
              className="flex-1 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none text-gray-900 dark:text-stone-100 placeholder-warm-400" />
            <button onClick={addIngredient} className="bg-primary text-white px-3 py-2 rounded-xl"><Plus size={16} /></button>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-3">Steps</label>
          <div className="space-y-2.5 mb-3">
            {form.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 h-6 bg-primary rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-gray-900 dark:text-stone-100 flex-1 leading-relaxed">{step}</p>
                <button onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })}><X size={14} className="text-warm-300" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea placeholder="Describe this step…" value={stepInput} onChange={(e) => setStepInput(e.target.value)}
              rows={2} className="flex-1 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none resize-none text-gray-900 dark:text-stone-100 placeholder-warm-400" />
            <button onClick={addStep} className="bg-primary text-white px-3 py-3 rounded-xl self-end"><Plus size={16} /></button>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !form.title.trim()}
          className="w-full py-4 bg-primary text-white font-bold rounded-2xl text-base shadow-soft active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Save Recipe'}
        </button>
      </div>
    </div>
  )
}

// ─── Photo Mode ───────────────────────────────────────────────────────────────

function PhotoMode({ onBack, addRecipe, navigate }) {
  const { anthropicApiKey } = useAppStore()
  const [stage, setStage] = useState('input')
  const [extracted, setExtracted] = useState(null)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const fileRef = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!anthropicApiKey) {
      toast.error('Add your Anthropic API key first (tap logo 5× for admin)')
      return
    }

    setAnalyzing(true)
    try {
      const base64 = await fileToBase64(file)
      const mediaType = file.type || 'image/jpeg'

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text: `Extract the recipe from this image. Return ONLY valid JSON:
{
  "title": "Recipe name",
  "description": "1-2 sentence description",
  "prep_time": 10,
  "cook_time": 20,
  "servings": 4,
  "tags": ["tag1"],
  "ingredients": [{ "amount": "2 cups", "name": "flour" }],
  "steps": ["Step 1", "Step 2"]
}
If no recipe is visible, return { "error": "No recipe found" }`,
              },
            ],
          }],
        }),
      })

      if (!res.ok) throw new Error('Claude API error')
      const data = await res.json()
      const recipe = JSON.parse(data.content?.[0]?.text?.trim())
      if (recipe.error) throw new Error(recipe.error)
      setExtracted(recipe)
      setStage('review')
    } catch (err) {
      toast.error(err.message || 'Could not extract recipe from image')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!extracted) return
    setSaving(true)
    try {
      const recipe = await addRecipe.mutateAsync({
        title: extracted.title,
        description: extracted.description || '',
        ingredients: extracted.ingredients || [],
        steps: extracted.steps || [],
        tags: extracted.tags || [],
        prep_time: extracted.prep_time || null,
        cook_time: extracted.cook_time || null,
        servings: extracted.servings || null,
      })
      toast.success('Recipe saved!')
      navigate(`/recipe/${recipe.id}`)
    } catch (err) {
      toast.error(err.message || 'Failed to save')
      setSaving(false)
    }
  }

  if (stage === 'review' && extracted) {
    return <ReviewScreen extracted={extracted} onChange={setExtracted} onSave={handleSave} onBack={() => setStage('input')} saving={saving} />
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <div className="px-5 pt-14 pb-6 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card">
          <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
        </button>
        <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-stone-50">Snap a Photo</h1>
      </div>

      <div className="px-5 space-y-4">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={analyzing}
          className="w-full bg-white dark:bg-stone-800 rounded-3xl shadow-card p-10 flex flex-col items-center justify-center gap-4 active:scale-[0.98] transition-transform border-2 border-dashed border-warm-200 dark:border-stone-600"
        >
          {analyzing ? (
            <>
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-sm font-semibold text-gray-900 dark:text-stone-50">Analyzing image…</p>
            </>
          ) : (
            <>
              <Camera size={40} className="text-warm-300 dark:text-stone-500" />
              <div className="text-center">
                <p className="font-semibold text-gray-900 dark:text-stone-50 text-sm">Take a photo or upload</p>
                <p className="text-warm-400 dark:text-stone-500 text-xs mt-1">Handwritten recipe, cookbook page, or screenshot</p>
              </div>
            </>
          )}
        </button>

        {!anthropicApiKey && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4">
            <p className="text-amber-800 dark:text-amber-300 text-xs font-semibold mb-1">API key needed</p>
            <p className="text-amber-700 dark:text-amber-400 text-xs">Add your Anthropic API key in admin settings (tap the logo 5 times).</p>
          </div>
        )}
      </div>
    </div>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
