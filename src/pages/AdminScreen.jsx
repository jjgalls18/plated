import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Database, Trash2, RotateCcw, ShoppingCart, Flame,
  AlertTriangle, Eye, EyeOff, Check, Zap, Download, X,
} from 'lucide-react'
import { useAppStore, calculateAiCosts } from '../stores/useAppStore'
import { useGrocery } from '../hooks/useGrocery'
import { useRecipes } from '../hooks/useRecipes'
import { isSupabaseConfigured } from '../lib/supabase'
import { MOCK_RECIPES } from '../data/mockRecipes'
import PlatedLogo from '../components/ui/PlatedLogo'
import toast from 'react-hot-toast'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt$ = (n) => n === 0 ? '$0.00' : n < 0.01 ? '<$0.01' : `$${n.toFixed(4)}`

function getDailyData(aiCostLog, days = 14) {
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    const label = d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1)
    result.push({ key, label, cost: 0 })
  }
  aiCostLog.forEach((e) => {
    const key = new Date(e.ts).toISOString().split('T')[0]
    const slot = result.find((d) => d.key === key)
    if (slot) slot.cost += e.cost
  })
  return result
}

function getMostExpensiveDay(aiCostLog) {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const byDay = {}
  aiCostLog
    .filter((e) => e.ts >= monthStart.getTime())
    .forEach((e) => {
      const key = new Date(e.ts).toLocaleDateString('en', { month: 'short', day: 'numeric' })
      byDay[key] = (byDay[key] || 0) + e.cost
    })
  const entries = Object.entries(byDay)
  if (!entries.length) return null
  return entries.reduce((max, cur) => cur[1] > max[1] ? cur : max)
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────

function DailySpendChart({ aiCostLog }) {
  const days = getDailyData(aiCostLog, 14)
  const maxCost = Math.max(...days.map((d) => d.cost), 0.00001)
  const empty = days.every((d) => d.cost === 0)
  const BAR_H = 56
  const BAR_W = 16
  const GAP = 5

  return (
    <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 rounded-2xl p-4">
      <p className="text-[11px] font-semibold text-primary-400 uppercase tracking-wide mb-3">
        Daily spend — last 14 days
      </p>
      {empty ? (
        <p className="text-warm-300 dark:text-stone-600 text-xs text-center py-5">No AI usage yet</p>
      ) : (
        <svg
          width="100%"
          viewBox={`0 0 ${days.length * (BAR_W + GAP) - GAP} ${BAR_H + 18}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {days.map((day, i) => {
            const barH = day.cost > 0 ? Math.max((day.cost / maxCost) * BAR_H, 3) : 0
            const x = i * (BAR_W + GAP)
            return (
              <g key={day.key}>
                {/* Background track */}
                <rect x={x} y={0} width={BAR_W} height={BAR_H} rx={4} fill="#C4622D" fillOpacity={0.1} />
                {/* Value bar */}
                {barH > 0 && (
                  <rect x={x} y={BAR_H - barH} width={BAR_W} height={barH} rx={4} fill="#C4622D" fillOpacity={0.85} />
                )}
                {/* Day label */}
                <text x={x + BAR_W / 2} y={BAR_H + 13} textAnchor="middle" fontSize={9} fill="#CEC5B8">
                  {day.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

// ─── Feature Breakdown ───────────────────────────────────────────────────────

const FEATURE_LABELS = {
  extraction: '🔗 URL Extraction',
  photo:      '📷 Photo Scan',
  search:     '🔍 Search',
  substitution: '🔄 Substitution',
  suggestion: '💡 Suggestion',
  other:      '⚙️ Other',
}

function FeatureBreakdown({ aiCostLog }) {
  const totals = {}
  const calls = {}
  aiCostLog.forEach((e) => {
    const f = e.feature || 'other'
    totals[f] = (totals[f] || 0) + e.cost
    calls[f] = (calls[f] || 0) + 1
  })
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1])

  if (!entries.length) {
    return <p className="text-warm-300 dark:text-stone-600 text-xs text-center py-3">No usage breakdown yet</p>
  }

  const maxCost = entries[0][1]
  return (
    <div className="space-y-3">
      {entries.map(([feature, cost]) => (
        <div key={feature}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700 dark:text-stone-300">
              {FEATURE_LABELS[feature] || feature}
            </span>
            <span className="text-xs font-bold text-primary">
              {fmt$(cost)} · {calls[feature]} call{calls[feature] !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${(cost / maxCost) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function UsageTab({ aiCostLog, aiCosts, clearAiCostLog }) {
  const callCount = aiCostLog.length
  const mostExpensive = getMostExpensiveDay(aiCostLog)
  const daysElapsed = new Date().getDate()
  const estimatedNext = daysElapsed > 0 ? (aiCosts.month / daysElapsed) * 30 : 0

  return (
    <div className="space-y-4">
      {/* Cost cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Today',      value: fmt$(aiCosts.today) },
          { label: 'This Week',  value: fmt$(aiCosts.week)  },
          { label: 'This Month', value: fmt$(aiCosts.month) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 rounded-2xl p-4 text-center"
          >
            <p className="text-primary font-bold text-lg leading-none">{value}</p>
            <p className="text-primary-400 dark:text-primary-300 text-[11px] font-semibold mt-1.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <DailySpendChart aiCostLog={aiCostLog} />

      {/* Summary stats */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5 space-y-3">
        <StatRow label="Total API calls" value={callCount.toLocaleString()} />
        <StatRow label="Most expensive day" value={mostExpensive ? `${mostExpensive[0]} · ${fmt$(mostExpensive[1])}` : '—'} />
        <StatRow label="Est. next month" value={estimatedNext > 0 ? fmt$(estimatedNext) : '—'} note="based on current pace" />
      </div>

      {/* Feature breakdown */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
        <p className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-4">
          Breakdown by feature
        </p>
        <FeatureBreakdown aiCostLog={aiCostLog} />
      </div>

      {callCount > 0 && (
        <button
          onClick={() => {
            if (window.confirm('Clear all AI cost history?')) {
              clearAiCostLog()
              toast.success('Cost log cleared')
            }
          }}
          className="w-full py-3 bg-warm-100 dark:bg-stone-700 text-warm-400 dark:text-stone-400 rounded-xl text-sm font-semibold active:scale-95 transition-all"
        >
          Clear cost history
        </button>
      )}
    </div>
  )
}

function HealthTab({ recipes, groceryListsGenerated }) {
  const totalCooked = recipes.reduce((sum, r) => sum + (r.made_count || 0), 0)
  const topRecipe = [...recipes].sort((a, b) => (b.made_count || 0) - (a.made_count || 0))[0]
  const avgRating = (() => {
    const rated = recipes.filter((r) => r.rating)
    if (!rated.length) return null
    return (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1)
  })()
  const tagsAll = recipes.flatMap((r) => r.tags || [])
  const tagCounts = tagsAll.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc }, {})
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Recipes saved',      value: recipes.length },
          { label: 'Times cooked',        value: totalCooked },
          { label: 'Grocery lists made',  value: groceryListsGenerated },
          { label: 'Avg rating',          value: avgRating ? `${avgRating} ★` : '—' },
          { label: 'Meal plans created',  value: 0, note: 'coming soon' },
          { label: 'Top tag',             value: topTag ? topTag[0] : '—' },
        ].map(({ label, value, note }) => (
          <div key={label} className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4">
            <p className="text-warm-400 dark:text-stone-500 text-[10px] font-semibold uppercase tracking-wide">{label}</p>
            <p className="text-gray-900 dark:text-stone-50 font-bold text-xl mt-1 truncate">{value}</p>
            {note && <p className="text-warm-300 dark:text-stone-600 text-[10px] mt-0.5">{note}</p>}
          </div>
        ))}
      </div>

      {topRecipe && topRecipe.made_count > 0 && (
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
          <p className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-2">
            Most cooked recipe
          </p>
          <p className="font-semibold text-gray-900 dark:text-stone-50 text-sm">{topRecipe.title}</p>
          <p className="text-primary text-xs mt-0.5">Made {topRecipe.made_count}× · {topRecipe.rating ? `${topRecipe.rating}/5 stars` : 'unrated'}</p>
        </div>
      )}
    </div>
  )
}

function ControlsTab({ recipes, aiEnabled, setAiEnabled, anthropicApiKey, setAnthropicApiKey, openaiApiKey, setOpenaiApiKey, qc, clearGroceryList, clearCookedDates, clearSharedGrocery }) {
  const [showKey, setShowKey] = useState(false)
  const [keyInput, setKeyInput] = useState(anthropicApiKey)
  const [showOpenAiKey, setShowOpenAiKey] = useState(false)
  const [openAiKeyInput, setOpenAiKeyInput] = useState(openaiApiKey)

  const handleSaveKey = () => {
    setAnthropicApiKey(keyInput)
    toast.success('Anthropic key saved')
  }

  const handleRemoveKey = () => {
    if (!window.confirm('Remove API key? This will disable AI features.')) return
    setAnthropicApiKey('')
    setKeyInput('')
    setAiEnabled(false)
    toast.success('API key removed')
  }

  const handleSaveOpenAiKey = () => {
    setOpenaiApiKey(openAiKeyInput)
    toast.success('OpenAI key saved')
  }

  const handleRemoveOpenAiKey = () => {
    if (!window.confirm('Remove OpenAI API key? This will disable video extraction.')) return
    setOpenaiApiKey('')
    setOpenAiKeyInput('')
    toast.success('OpenAI key removed')
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(recipes, null, 2)], { type: 'application/json' })
    trigger(blob, 'plated-recipes.json')
  }

  const handleExportText = () => {
    const text = recipes.map((r) => {
      const lines = [r.title, '─'.repeat(Math.min(r.title.length, 40))]
      if (r.description) lines.push(r.description)
      lines.push('')
      if (r.ingredients?.length) {
        lines.push('Ingredients:')
        r.ingredients.forEach((i) => lines.push(`  ${i.amount ? i.amount + ' ' : ''}${i.name}`))
        lines.push('')
      }
      if (r.steps?.length) {
        lines.push('Instructions:')
        r.steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`))
        lines.push('')
      }
      const meta = []
      if (r.prep_time) meta.push(`Prep ${r.prep_time}m`)
      if (r.cook_time) meta.push(`Cook ${r.cook_time}m`)
      if (r.servings)  meta.push(`Serves ${r.servings}`)
      if (r.rating)    meta.push(`${r.rating}/5 stars`)
      if (meta.length) lines.push(meta.join(' · '))
      if (r.tags?.length) lines.push(`Tags: ${r.tags.join(', ')}`)
      if (r.source_url) lines.push(`Source: ${r.source_url}`)
      return lines.join('\n')
    }).join('\n\n════════════════════════════\n\n')
    trigger(new Blob([text], { type: 'text/plain' }), 'plated-recipes.txt')
  }

  const trigger = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Downloaded ${filename}`)
  }

  const handleClearCache = () => {
    qc.clear()
    localStorage.removeItem('plated-weather')
    toast.success('Cache cleared')
  }

  return (
    <div className="space-y-4">
      {/* API Key */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-violet-50 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-stone-50 text-sm">AI Features</p>
            <p className="text-warm-400 dark:text-stone-500 text-xs">Anthropic API</p>
          </div>
          <button
            onClick={() => {
              if (!anthropicApiKey && !aiEnabled) { toast.error('Add an API key first'); return }
              setAiEnabled(!aiEnabled)
              toast.success(aiEnabled ? 'AI disabled' : 'AI enabled')
            }}
            className={`w-12 h-6 rounded-full transition-all duration-200 relative ${aiEnabled ? 'bg-primary' : 'bg-warm-200 dark:bg-stone-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all duration-200 ${aiEnabled ? 'left-[26px]' : 'left-0.5'}`} />
          </button>
        </div>

        <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-2">
          API Key
        </label>
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="sk-ant-..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full pr-10 pl-3 py-2.5 bg-warm-100 dark:bg-stone-700 rounded-xl text-sm font-mono text-gray-900 dark:text-stone-100 placeholder-warm-300 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500">
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button onClick={handleSaveKey} className="bg-primary text-white px-3 py-2 rounded-xl">
            <Check size={16} />
          </button>
          {anthropicApiKey && (
            <button onClick={handleRemoveKey} className="bg-warm-100 dark:bg-stone-700 text-rose-400 px-3 py-2 rounded-xl">
              <X size={16} />
            </button>
          )}
        </div>
        <p className="text-[11px] text-warm-400 dark:text-stone-500 leading-relaxed">
          Stored locally on this device only. Never sent anywhere except Anthropic.
        </p>

        <div className="mt-4 pt-4 border-t border-warm-100 dark:border-stone-700">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide flex-1">OpenAI Key</p>
            <span className="text-[10px] text-warm-300 dark:text-stone-600">for video transcription</span>
          </div>
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <input
                type={showOpenAiKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={openAiKeyInput}
                onChange={(e) => setOpenAiKeyInput(e.target.value)}
                className="w-full pr-10 pl-3 py-2.5 bg-warm-100 dark:bg-stone-700 rounded-xl text-sm font-mono text-gray-900 dark:text-stone-100 placeholder-warm-300 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button onClick={() => setShowOpenAiKey(!showOpenAiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500">
                {showOpenAiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button onClick={handleSaveOpenAiKey} className="bg-primary text-white px-3 py-2 rounded-xl">
              <Check size={16} />
            </button>
            {openaiApiKey && (
              <button onClick={handleRemoveOpenAiKey} className="bg-warm-100 dark:bg-stone-700 text-rose-400 px-3 py-2 rounded-xl">
                <X size={16} />
              </button>
            )}
          </div>
          <p className="text-[11px] text-warm-400 dark:text-stone-500 leading-relaxed">
            Used only for Whisper audio transcription of TikTok/Instagram/YouTube videos.
          </p>
        </div>
      </div>

      {/* Export */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
        <p className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-4">Export Recipes</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExportJson}
            disabled={recipes.length === 0}
            className="flex items-center justify-center gap-2 py-3 bg-primary-50 dark:bg-primary-900/20 text-primary rounded-xl text-sm font-semibold active:scale-95 transition-all disabled:opacity-40"
          >
            <Download size={15} />
            JSON
          </button>
          <button
            onClick={handleExportText}
            disabled={recipes.length === 0}
            className="flex items-center justify-center gap-2 py-3 bg-primary-50 dark:bg-primary-900/20 text-primary rounded-xl text-sm font-semibold active:scale-95 transition-all disabled:opacity-40"
          >
            <Download size={15} />
            Text
          </button>
        </div>
        <p className="text-[11px] text-warm-400 dark:text-stone-500 mt-2 text-center">
          {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} · downloads to your device
        </p>
      </div>

      {/* Cache & Data */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
        <p className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-4">Cache & Data</p>
        <div className="space-y-3">
          <ActionRow icon={<RotateCcw size={15} />} label="Clear app cache" description="React Query + weather cache" color="text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400" onClick={handleClearCache} />
          <ActionRow icon={<ShoppingCart size={15} />} label="Clear grocery list" description="Removes all shared items" color="text-sage bg-sage-50 dark:bg-sage-900/20" onClick={() => { if (window.confirm('Clear grocery list?')) { clearSharedGrocery(); clearGroceryList(); toast.success('Grocery list cleared') } }} />
          <ActionRow icon={<Flame size={15} />} label="Clear cooking log" description="Resets streak to 0" color="text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400" onClick={() => { if (window.confirm('Clear all cooked dates?')) { clearCookedDates(); toast.success('Cooking log cleared') } }} />
          {!isSupabaseConfigured && (
            <ActionRow icon={<Database size={15} />} label="Reset mock recipes" description="Restore 4 default recipes" color="text-warm-400 bg-warm-100 dark:bg-stone-700 dark:text-stone-400" onClick={() => { if (window.confirm('Reset recipes to defaults?')) { localStorage.setItem('plated-mock-recipes', JSON.stringify(MOCK_RECIPES)); qc.invalidateQueries({ queryKey: ['recipes'] }); toast.success('Recipes reset') } }} />
          )}
        </div>
      </div>

      {/* Danger */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5 border border-rose-200 dark:border-rose-900/40">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={15} className="text-rose-500" />
          <p className="text-rose-600 dark:text-rose-400 text-xs font-semibold uppercase tracking-wide">Danger Zone</p>
        </div>
        <button
          onClick={() => {
            if (!window.confirm('⚠️ Wipe ALL local app data?')) return
            if (!window.confirm('This cannot be undone. Are you sure?')) return
            localStorage.clear()
            window.location.reload()
          }}
          className="w-full py-3 bg-rose-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Trash2 size={15} />
          Wipe all local data & reload
        </button>
      </div>
    </div>
  )
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function StatRow({ label, value, note }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-700 dark:text-stone-300">{label}</p>
        {note && <p className="text-[10px] text-warm-300 dark:text-stone-600">{note}</p>}
      </div>
      <p className="text-sm font-bold text-gray-900 dark:text-stone-50">{value}</p>
    </div>
  )
}

function ActionRow({ icon, label, description, color, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 bg-warm-50 dark:bg-stone-700/50 rounded-xl active:scale-[0.98] transition-all text-left">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-stone-50">{label}</p>
        <p className="text-xs text-warm-400 dark:text-stone-500 mt-0.5">{description}</p>
      </div>
    </button>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

const TABS = ['Usage', 'Health', 'Controls']

export default function AdminScreen() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: recipes = [] } = useRecipes()
  const [activeTab, setActiveTab] = useState('Usage')
  const {
    aiCostLog, clearAiCostLog,
    aiEnabled, setAiEnabled,
    anthropicApiKey, setAnthropicApiKey,
    openaiApiKey, setOpenaiApiKey,
    groceryListsGenerated,
    clearGroceryList, clearCookedDates,
    darkMode,
  } = useAppStore()

  const aiCosts = calculateAiCosts(aiCostLog)
  const { clearAll: clearSharedGrocery } = useGrocery()

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      {/* Header */}
      <div className="relative pt-14 pb-4 px-5">
        <button
          onClick={() => navigate(-1)}
          className="absolute left-5 top-14 w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card"
        >
          <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
        </button>
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="shadow-soft rounded-full">
            <PlatedLogo size={96} dark={darkMode} />
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-stone-50">Plated Admin</h1>
            <p className="text-warm-400 dark:text-stone-500 text-sm mt-0.5">
              {isSupabaseConfigured ? '🟢 Supabase connected' : '🟡 Demo mode'}
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-5 mb-5">
        <div className="flex bg-white dark:bg-stone-800 rounded-2xl shadow-card p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab ? 'bg-primary text-white shadow-soft' : 'text-warm-400 dark:text-stone-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-5 pb-12">
        {activeTab === 'Usage' && (
          <UsageTab aiCostLog={aiCostLog} aiCosts={aiCosts} clearAiCostLog={clearAiCostLog} />
        )}
        {activeTab === 'Health' && (
          <HealthTab recipes={recipes} groceryListsGenerated={groceryListsGenerated} />
        )}
        {activeTab === 'Controls' && (
          <ControlsTab
            recipes={recipes}
            aiEnabled={aiEnabled} setAiEnabled={setAiEnabled}
            anthropicApiKey={anthropicApiKey} setAnthropicApiKey={setAnthropicApiKey}
            openaiApiKey={openaiApiKey} setOpenaiApiKey={setOpenaiApiKey}
            qc={qc}
            clearGroceryList={clearGroceryList}
            clearCookedDates={clearCookedDates}
            clearSharedGrocery={clearSharedGrocery}
          />
        )}
      </div>
    </div>
  )
}
