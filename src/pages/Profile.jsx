import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAppStore, calculateStreak } from '../stores/useAppStore'
import { useRecipes } from '../hooks/useRecipes'
import { usePartner } from '../hooks/usePartner'
import { isSupabaseConfigured } from '../lib/supabase'
import toast from 'react-hot-toast'
import {
  ChefHat, Flame, Star, Zap, ShoppingCart,
  LogOut, Eye, EyeOff, Check, X, ShoppingBag, Sun, Moon,
  Copy, UserPlus, Link2, Link2Off
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

export default function Profile() {
  const { signOut } = useAuth()
  const { data: recipes = [] } = useRecipes()
  const { aiEnabled, setAiEnabled, anthropicApiKey, setAnthropicApiKey, groceryItems, toggleGroceryItem, clearCheckedItems, cookedDates, darkMode, setDarkMode } = useAppStore()
  const { inviteCode, partner, joinWithCode, unlinkPartner } = usePartner()
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState(anthropicApiKey)
  const [activeTab, setActiveTab] = useState('overview')
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  const totalCooked = recipes.reduce((sum, r) => sum + (r.made_count || 0), 0)
  const avgRating = recipes.filter((r) => r.rating).reduce((sum, r, _, arr) => sum + r.rating / arr.length, 0)
  const checkedCount = groceryItems.filter((i) => i.checked).length
  const streak = calculateStreak(cookedDates)

  const handleSaveApiKey = () => {
    setAnthropicApiKey(apiKeyInput)
    toast.success('API key saved')
  }

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <PageHeader />
      {/* Header */}
      <div className="px-5 pt-2 pb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-stone-50 mb-1">Us</h1>
        <p className="text-warm-400 dark:text-stone-500 text-sm">Your shared kitchen stats</p>
      </div>

      {/* Tab bar */}
      <div className="px-5 mb-5">
        <div className="flex bg-white dark:bg-stone-800 rounded-2xl shadow-card p-1">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'grocery', label: `Grocery${groceryItems.length > 0 ? ` (${groceryItems.length})` : ''}` },
            { id: 'settings', label: 'Settings' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === id ? 'bg-primary text-white shadow-soft' : 'text-warm-400 dark:text-stone-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="px-5 space-y-4">
          {/* Couple card */}
          <div className="bg-gradient-to-br from-primary to-primary-700 rounded-3xl p-5 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <ChefHat size={24} className="text-white" />
              </div>
              <div>
                <p className="font-display font-bold text-xl">Jacob &amp; Madi</p>
                <p className="text-white/70 text-xs">Cooking together</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <StatBlock icon={<ChefHat size={16} />} value={recipes.length} label="Recipes" />
              <StatBlock icon={<Flame size={16} />} value={totalCooked} label="Cooked" />
              <StatBlock icon={<Star size={16} />} value={avgRating ? avgRating.toFixed(1) : '—'} label="Rating" />
              <StatBlock icon={<Flame size={16} />} value={streak} label="Streak" />
            </div>
          </div>

          {/* Partner sync */}
          {isSupabaseConfigured && (
            <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
              {partner ? (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                      <Link2 size={18} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-stone-50 text-sm">Linked with {partner.display_name || 'Partner'}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">Sharing recipes & grocery list</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await unlinkPartner()
                      toast.success('Accounts unlinked')
                    }}
                    className="flex items-center gap-2 text-xs text-warm-400 dark:text-stone-500 hover:text-red-400 transition-colors"
                  >
                    <Link2Off size={12} />
                    Unlink accounts
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary-50 dark:bg-primary/20 rounded-xl flex items-center justify-center">
                      <UserPlus size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-stone-50 text-sm">Invite your partner</p>
                      <p className="text-xs text-warm-400 dark:text-stone-500">Share your code or enter theirs</p>
                    </div>
                  </div>

                  {/* Your invite code */}
                  {inviteCode && (
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-1.5">Your invite code</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-warm-100 dark:bg-stone-700 rounded-xl px-4 py-2.5">
                          <p className="font-mono font-bold text-lg text-gray-900 dark:text-stone-50 tracking-widest">{inviteCode.toUpperCase()}</p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(inviteCode.toUpperCase())
                            toast.success('Code copied!')
                          }}
                          className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center active:scale-90 transition-transform"
                        >
                          <Copy size={16} className="text-white" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Enter partner code */}
                  <p className="text-[11px] font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-1.5">Enter partner's code</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="XXXXXXXX"
                      maxLength={8}
                      className="flex-1 bg-warm-100 dark:bg-stone-700 rounded-xl px-4 py-2.5 font-mono font-bold text-gray-900 dark:text-stone-50 placeholder-warm-300 dark:placeholder-stone-600 outline-none focus:ring-2 focus:ring-primary/30 tracking-widest text-sm"
                    />
                    <button
                      disabled={joinCode.length < 6 || joining}
                      onClick={async () => {
                        setJoining(true)
                        try {
                          const p = await joinWithCode(joinCode)
                          toast.success(`Linked with ${p.display_name || 'your partner'}! 🎉`)
                          setJoinCode('')
                        } catch (err) {
                          toast.error(err.message)
                        } finally {
                          setJoining(false)
                        }
                      }}
                      className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all"
                    >
                      {joining ? '…' : 'Join'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Our Cookbook */}
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-stone-50 mb-3">Our Cookbook</h3>
            {recipes.filter((r) => r.made_count > 0).length === 0 ? (
              <p className="text-warm-400 dark:text-stone-500 text-sm text-center py-4">
                Recipes you've cooked will appear here.
              </p>
            ) : (
              <div className="space-y-3">
                {recipes
                  .filter((r) => r.made_count > 0)
                  .sort((a, b) => b.made_count - a.made_count)
                  .slice(0, 5)
                  .map((recipe) => (
                    <div key={recipe.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-50 dark:bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-primary text-xs font-bold">{recipe.made_count}×</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-stone-100 flex-1 line-clamp-1">{recipe.title}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4 flex items-center gap-3 text-rose-500 active:scale-[0.98] transition-all"
          >
            <LogOut size={18} />
            <span className="text-sm font-semibold">Sign out</span>
          </button>
        </div>
      )}

      {activeTab === 'grocery' && (
        <div className="px-5 space-y-4">
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-primary" />
                <h3 className="font-semibold text-gray-900 dark:text-stone-50">Grocery List</h3>
              </div>
              {checkedCount > 0 && (
                <button
                  onClick={clearCheckedItems}
                  className="text-xs text-warm-400 dark:text-stone-500 font-semibold"
                >
                  Clear {checkedCount} checked
                </button>
              )}
            </div>

            {groceryItems.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart size={36} className="text-warm-300 dark:text-stone-600 mx-auto mb-3" />
                <p className="text-warm-400 dark:text-stone-500 text-sm">
                  Add ingredients from any recipe using the "Grocery List" button on the recipe page.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {groceryItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleGroceryItem(item.id)}
                    className="w-full flex items-center gap-3 py-2.5 text-left"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      item.checked ? 'bg-sage border-sage' : 'border-warm-300 dark:border-stone-600'
                    }`}>
                      {item.checked && <Check size={11} className="text-white" />}
                    </div>
                    <div className="flex-1">
                      <span className={`text-sm font-medium transition-colors ${item.checked ? 'text-warm-400 dark:text-stone-600 line-through' : 'text-gray-900 dark:text-stone-100'}`}>
                        {item.amount && <span className="text-warm-400 dark:text-stone-500 mr-1.5">{item.amount}</span>}
                        {item.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="px-5 space-y-4">
          {/* Supabase status */}
          {!isSupabaseConfigured && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4">
              <p className="text-amber-800 dark:text-amber-300 text-xs font-semibold mb-1">Demo mode active</p>
              <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file to sync recipes between devices and with your partner.
              </p>
            </div>
          )}

          {/* Dark mode toggle */}
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-stone-100 dark:bg-stone-700 rounded-xl flex items-center justify-center">
                {darkMode
                  ? <Sun size={20} className="text-amber-400" />
                  : <Moon size={20} className="text-stone-500" />
                }
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-stone-50 text-sm">Dark Mode</p>
                <p className="text-warm-400 dark:text-stone-500 text-xs">{darkMode ? 'On — easy on the eyes' : 'Off — bright and light'}</p>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`w-12 h-6 rounded-full transition-all duration-200 relative ${
                  darkMode ? 'bg-primary' : 'bg-warm-200 dark:bg-stone-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all duration-200 ${
                  darkMode ? 'left-[26px]' : 'left-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* AI toggle */}
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
                <Zap size={20} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-stone-50 text-sm">AI Features</p>
                <p className="text-warm-400 dark:text-stone-500 text-xs">Recipe extraction, suggestions, and more</p>
              </div>
              <button
                onClick={() => {
                  if (!anthropicApiKey && !aiEnabled) {
                    toast.error('Add your Anthropic API key first')
                    return
                  }
                  setAiEnabled(!aiEnabled)
                  toast.success(aiEnabled ? 'AI features disabled' : 'AI features enabled!')
                }}
                className={`w-12 h-6 rounded-full transition-all duration-200 relative ${
                  aiEnabled ? 'bg-primary' : 'bg-warm-200 dark:bg-stone-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all duration-200 ${
                  aiEnabled ? 'left-[26px]' : 'left-0.5'
                }`} />
              </button>
            </div>

            {/* API Key input */}
            <div>
              <label className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide block mb-2">
                Anthropic API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="sk-ant-..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full pr-10 pl-3 py-2.5 bg-warm-100 dark:bg-stone-700 rounded-xl text-sm font-mono text-gray-900 dark:text-stone-100 placeholder-warm-300 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500"
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={handleSaveApiKey}
                  className="bg-primary text-white px-3 py-2 rounded-xl"
                >
                  <Check size={16} />
                </button>
              </div>
              <p className="text-[11px] text-warm-400 dark:text-stone-500 mt-2 leading-relaxed">
                Your key is stored locally on this device only. Never sent to any server except Anthropic's.
              </p>
            </div>
          </div>

          {/* About */}
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5 text-center">
            <span className="font-display text-2xl font-bold text-primary">Plated</span>
            <p className="text-warm-400 dark:text-stone-500 text-xs mt-1">Your shared kitchen</p>
            <p className="text-warm-300 dark:text-stone-600 text-[11px] mt-3">v1.0.0 · Made with love</p>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBlock({ icon, value, label }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-white/80 mb-1">{icon}</div>
      <p className="font-bold text-white text-lg">{value}</p>
      <p className="text-white/60 text-[10px]">{label}</p>
    </div>
  )
}
