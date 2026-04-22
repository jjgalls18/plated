import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, GripVertical } from 'lucide-react'
import { useRecipe, useUpdateRecipe } from '../hooks/useRecipes'
import toast from 'react-hot-toast'

export default function EditRecipe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: recipe, isLoading } = useRecipe(id)
  const updateRecipe = useUpdateRecipe()

  if (isLoading) return <LoadingSkeleton />
  if (!recipe) return null

  return <EditForm recipe={recipe} navigate={navigate} updateRecipe={updateRecipe} />
}

function EditForm({ recipe, navigate, updateRecipe }) {
  const [form, setForm] = useState({
    title: recipe.title || '',
    description: recipe.description || '',
    prep_time: recipe.prep_time ?? '',
    cook_time: recipe.cook_time ?? '',
    servings: recipe.servings ?? '',
    tags: recipe.tags || [],
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
  })
  const [saving, setSaving] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [ingInput, setIngInput] = useState({ amount: '', name: '' })
  const [stepInput, setStepInput] = useState('')

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  // ─── Ingredients ─────────────────────────────────────────────────────────────
  const addIngredient = () => {
    if (!ingInput.name.trim()) return
    set('ingredients', [...form.ingredients, { ...ingInput }])
    setIngInput({ amount: '', name: '' })
  }

  const removeIngredient = (i) =>
    set('ingredients', form.ingredients.filter((_, j) => j !== i))

  const updateIngredient = (i, field, val) =>
    set('ingredients', form.ingredients.map((ing, j) => j === i ? { ...ing, [field]: val } : ing))

  // ─── Steps ───────────────────────────────────────────────────────────────────
  const addStep = () => {
    if (!stepInput.trim()) return
    set('steps', [...form.steps, stepInput.trim()])
    setStepInput('')
  }

  const removeStep = (i) =>
    set('steps', form.steps.filter((_, j) => j !== i))

  const updateStep = (i, val) =>
    set('steps', form.steps.map((s, j) => j === i ? val : s))

  // ─── Tags ─────────────────────────────────────────────────────────────────
  const addTag = () => {
    const t = newTag.trim().toLowerCase()
    if (!t || form.tags.includes(t)) { setNewTag(''); return }
    set('tags', [...form.tags, t])
    setNewTag('')
  }

  const removeTag = (i) => set('tags', form.tags.filter((_, j) => j !== i))

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      await updateRecipe.mutateAsync({
        id: recipe.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        prep_time: form.prep_time !== '' ? parseInt(form.prep_time) || null : null,
        cook_time: form.cook_time !== '' ? parseInt(form.cook_time) || null : null,
        servings: form.servings !== '' ? parseInt(form.servings) || null : null,
        tags: form.tags,
        ingredients: form.ingredients,
        steps: form.steps,
      })
      toast.success('Recipe updated!')
      navigate(`/recipe/${recipe.id}`)
    } catch (err) {
      toast.error(err.message || 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900 pb-10">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center gap-3 bg-cream dark:bg-stone-900 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card flex-shrink-0"
        >
          <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-stone-50">Edit Recipe</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-primary text-white font-semibold text-sm rounded-2xl shadow-soft active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="px-5 space-y-4">
        {/* Title */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-2">Title</label>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className="w-full text-gray-900 dark:text-stone-50 font-semibold text-lg outline-none bg-transparent"
            placeholder="Recipe name"
          />
        </div>

        {/* Description */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-2">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            placeholder="Short description (optional)"
            className="w-full text-sm text-gray-900 dark:text-stone-100 outline-none resize-none bg-transparent placeholder-warm-300 dark:placeholder-stone-600"
          />
        </div>

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
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                className="w-full text-gray-900 dark:text-stone-50 font-bold text-lg outline-none bg-transparent"
                placeholder="—"
              />
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-3">Tags</label>
          {form.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {form.tags.map((tag, i) => (
                <span key={i} className="flex items-center gap-1.5 bg-primary-50 dark:bg-primary/20 text-primary text-xs font-semibold px-3 py-1 rounded-full capitalize">
                  {tag}
                  <button onClick={() => removeTag(i)}><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              placeholder="Add tag…"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              className="flex-1 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none text-gray-900 dark:text-stone-100"
            />
            <button onClick={addTag} className="bg-primary text-white px-3 py-2 rounded-xl">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
          <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-3">
            Ingredients ({form.ingredients.length})
          </label>
          <div className="space-y-2 mb-3">
            {form.ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={ing.amount || ''}
                  onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
                  placeholder="Amt"
                  className="w-20 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none text-gray-900 dark:text-stone-100"
                />
                <input
                  value={ing.name}
                  onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                  placeholder="Ingredient"
                  className="flex-1 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none text-gray-900 dark:text-stone-100"
                />
                <button onClick={() => removeIngredient(i)} className="p-1.5 text-warm-300 hover:text-rose-400 transition-colors">
                  <X size={15} />
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
            Steps ({form.steps.length})
          </label>
          <div className="space-y-3 mb-3">
            {form.steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="w-6 h-6 bg-primary rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-2">
                  {i + 1}
                </span>
                <textarea
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  rows={2}
                  className="flex-1 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none resize-none text-gray-900 dark:text-stone-100"
                />
                <button onClick={() => removeStep(i)} className="p-1.5 text-warm-300 hover:text-rose-400 transition-colors mt-1.5">
                  <X size={15} />
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
              className="flex-1 text-sm bg-warm-100 dark:bg-stone-700 rounded-xl px-3 py-2 outline-none resize-none text-gray-900 dark:text-stone-100 placeholder-warm-300 dark:placeholder-stone-600"
            />
            <button onClick={addStep} className="bg-primary text-white px-3 py-2 rounded-xl self-end">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Save button (bottom) */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-primary text-white font-bold rounded-2xl text-sm shadow-soft active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900 px-5 pt-14 space-y-4 animate-pulse">
      <div className="h-10 bg-warm-200 dark:bg-stone-700 rounded-2xl w-3/4" />
      <div className="h-32 bg-warm-200 dark:bg-stone-700 rounded-2xl" />
      <div className="h-20 bg-warm-200 dark:bg-stone-700 rounded-2xl" />
      <div className="h-48 bg-warm-200 dark:bg-stone-700 rounded-2xl" />
    </div>
  )
}
