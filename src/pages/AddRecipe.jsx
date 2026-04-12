import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Link as LinkIcon, PenLine, Camera, Plus, X, ChevronRight } from 'lucide-react'
import { useAddRecipe } from '../hooks/useRecipes'
import toast from 'react-hot-toast'

const MODES = [
  { id: 'url', icon: LinkIcon, label: 'Paste a link', description: 'TikTok, Instagram, or any website' },
  { id: 'manual', icon: PenLine, label: 'Type it out', description: 'Enter ingredients and steps' },
  { id: 'photo', icon: Camera, label: 'Snap a photo', description: 'Handwritten notes or cookbook page' },
]

export default function AddRecipe() {
  const navigate = useNavigate()
  const [mode, setMode] = useState(null)
  const addRecipe = useAddRecipe()

  if (!mode) return <ModeSelect onSelect={setMode} />

  if (mode === 'url') return <UrlMode onBack={() => setMode(null)} addRecipe={addRecipe} navigate={navigate} />
  if (mode === 'manual') return <ManualMode onBack={() => setMode(null)} addRecipe={addRecipe} navigate={navigate} />
  if (mode === 'photo') return <PhotoMode onBack={() => setMode(null)} />

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
            className="w-full bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5 flex items-center gap-4 hover:shadow-card-hover transition-shadow active:scale-[0.98] transition-transform text-left"
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

function UrlMode({ onBack, addRecipe, navigate }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)

  const handleFetch = async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      setPreview({
        url,
        domain,
        title: `Recipe from ${domain}`,
      })
    } catch {
      toast.error('Please enter a valid URL')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!preview) return
    setLoading(true)
    try {
      const recipe = await addRecipe.mutateAsync({
        title: preview.title,
        source_url: preview.url,
        thumbnail_url: preview.thumbnail_url || null,
        tags: [],
        ingredients: [],
        steps: [],
      })
      toast.success('Recipe saved!')
      navigate(`/recipe/${recipe.id}`)
    } catch (err) {
      toast.error(err.message || 'Failed to save recipe')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <div className="px-5 pt-14 pb-6 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card">
          <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
        </button>
        <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-stone-50">Paste a link</h1>
      </div>

      <div className="px-5 space-y-4">
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4 flex gap-3">
          <input
            type="url"
            placeholder="https://www.seriouseats.com/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 text-sm text-gray-900 dark:text-stone-100 placeholder-warm-400 dark:placeholder-stone-500 outline-none bg-transparent"
          />
          <button
            onClick={handleFetch}
            disabled={loading || !url}
            className="bg-primary text-white text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 active:scale-95 transition-all"
          >
            Fetch
          </button>
        </div>

        {preview && (
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4 animate-fade-up">
            <div className="flex gap-3 mb-4">
              {preview.thumbnail_url && (
                <img src={preview.thumbnail_url} alt="" className="w-20 h-20 rounded-xl object-cover" />
              )}
              <div className="flex-1">
                <p className="text-[11px] text-warm-400 dark:text-stone-500 font-medium mb-1">{preview.domain}</p>
                <input
                  value={preview.title}
                  onChange={(e) => setPreview({ ...preview, title: e.target.value })}
                  className="font-semibold text-gray-900 dark:text-stone-50 text-sm w-full outline-none bg-transparent"
                />
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 mb-4">
              <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                <span className="font-semibold">AI extraction is off.</span> The recipe link has been saved. Enable AI in Settings to automatically extract ingredients and steps.
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full py-3 bg-primary text-white font-semibold rounded-xl text-sm active:scale-95 transition-all disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Save Recipe'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ManualMode({ onBack, addRecipe, navigate }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    prep_time: '',
    cook_time: '',
    servings: '4',
    tags: [],
    ingredients: [],
    steps: [],
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
        {/* Title */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-2">Title *</label>
          <input
            placeholder="What's cooking?"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full text-gray-900 dark:text-stone-50 font-semibold text-lg outline-none placeholder-warm-300 dark:placeholder-stone-600 bg-transparent"
          />
        </div>

        {/* Description */}
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

        {/* Timing + Servings */}
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

        {/* Tags */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-3">Tags</label>
          <div className="flex gap-2 flex-wrap mb-3">
            {form.tags.map((tag, i) => (
              <span key={i} className="flex items-center gap-1.5 bg-primary-50 dark:bg-primary/20 text-primary text-xs font-semibold px-3 py-1 rounded-full capitalize">
                {tag}
                <button onClick={() => setForm({ ...form, tags: form.tags.filter((_, j) => j !== i) })}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              placeholder="e.g. italian, quick, date night"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              className="flex-1 text-sm text-gray-900 dark:text-stone-100 outline-none placeholder-warm-300 dark:placeholder-stone-500 bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2"
            />
            <button onClick={addTag} className="bg-primary text-white px-3 py-2 rounded-xl">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-3">Ingredients</label>
          <div className="space-y-2 mb-3">
            {form.ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-warm-100 dark:border-stone-700">
                <span className="text-sm text-warm-400 dark:text-stone-500 font-medium min-w-[4rem]">{ing.amount}</span>
                <span className="text-sm text-gray-900 dark:text-stone-100 flex-1">{ing.name}</span>
                <button onClick={() => setForm({ ...form, ingredients: form.ingredients.filter((_, j) => j !== i) })}>
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
              className="w-20 text-sm text-gray-900 dark:text-stone-100 outline-none placeholder-warm-300 dark:placeholder-stone-500 bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2"
            />
            <input
              placeholder="Ingredient"
              value={ingInput.name}
              onChange={(e) => setIngInput({ ...ingInput, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addIngredient()}
              className="flex-1 text-sm text-gray-900 dark:text-stone-100 outline-none placeholder-warm-300 dark:placeholder-stone-500 bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2"
            />
            <button onClick={addIngredient} className="bg-primary text-white px-3 py-2 rounded-xl">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-3">Steps</label>
          <div className="space-y-2.5 mb-3">
            {form.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 h-6 bg-primary rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-gray-900 dark:text-stone-100 flex-1 leading-relaxed">{step}</p>
                <button onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })}>
                  <X size={14} className="text-warm-300 dark:text-stone-600" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              placeholder="Describe this step…"
              value={stepInput}
              onChange={(e) => setStepInput(e.target.value)}
              rows={2}
              className="flex-1 text-sm text-gray-900 dark:text-stone-100 outline-none placeholder-warm-300 dark:placeholder-stone-500 bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 resize-none"
            />
            <button onClick={addStep} className="bg-primary text-white px-3 py-3 rounded-xl self-end">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Save */}
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

function PhotoMode({ onBack }) {
  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <div className="px-5 pt-14 pb-6 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card">
          <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
        </button>
        <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-stone-50">Snap a Photo</h1>
      </div>

      <div className="px-5">
        <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-card p-8 text-center">
          <div className="w-20 h-20 bg-warm-100 dark:bg-stone-700 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Camera size={36} className="text-warm-400 dark:text-stone-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-stone-50 mb-2">Coming soon</h3>
          <p className="text-warm-400 dark:text-stone-500 text-sm leading-relaxed">
            Upload a photo of your handwritten recipe or cookbook page. AI will extract everything for you once enabled.
          </p>
        </div>
      </div>
    </div>
  )
}
