import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAppStore, calculateStreak } from '../stores/useAppStore'
import { useRecipes } from '../hooks/useRecipes'
import { usePartner } from '../hooks/usePartner'
import { useGrocery } from '../hooks/useGrocery'
import { useCookLog } from '../hooks/useCookLog'
import { useCoupleStory } from '../hooks/useCoupleStory'
import { isSupabaseConfigured } from '../lib/supabase'
import toast from 'react-hot-toast'
import {
  ChefHat, Flame, Star, ShoppingCart,
  LogOut, Check, ShoppingBag, Sun, Moon,
  Copy, UserPlus, Link2, Link2Off, RotateCcw, X, Pencil, BookHeart,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import ThumbnailPicker from '../components/ui/ThumbnailPicker'

export default function Profile() {
  const { signOut, profile, updateProfile } = useAuth()
  const { data: recipes = [] } = useRecipes()
  const { cookedDates, darkMode, setDarkMode } = useAppStore()
  const { items: groceryItems, toggleItem, clearChecked } = useGrocery()
  const { inviteCode, partner, joinWithCode, unlinkPartner } = usePartner()
  const { entries, myId, partnerId } = useCookLog()
  const [activeTab, setActiveTab] = useState('overview')
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [editingName, setEditingName] = useState(false)

  const totalCooked = recipes.reduce((sum, r) => sum + (r.made_count || 0), 0)
  const avgRating = recipes.filter((r) => r.rating).reduce((sum, r, _, arr) => sum + r.rating / arr.length, 0)
  const checkedCount = groceryItems.filter((i) => i.checked).length

  const streak = calculateStreak(cookedDates)

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
            { id: 'story', label: 'Our Story' },
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

          {/* This month's competition */}
          <CompetitionCard entries={entries} myId={myId} partnerId={partnerId} myName={profile?.display_name || 'You'} partnerName={partner?.display_name || 'Partner'} />

          {/* Recent memories */}
          <MemoriesCard entries={entries} />

          {/* Most Cooked */}
          <MostCookedCard entries={entries} recipes={recipes} />

          {/* Day patterns */}
          <DayPatternsCard entries={entries} recipes={recipes} />

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

      {activeTab === 'story' && <StoryTab />}

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
                  onClick={clearChecked}
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
                    onClick={() => toggleItem(item.id, item.checked)}
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

          {/* Display name */}
          {isSupabaseConfigured && (
            <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
              <p className="font-semibold text-gray-900 dark:text-stone-50 text-sm mb-3">Your Name</p>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                    placeholder="Display name"
                    className="flex-1 px-4 py-2.5 bg-warm-50 dark:bg-stone-700 rounded-xl text-sm font-medium text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={async () => {
                      const name = nameInput.trim()
                      if (!name) return
                      try {
                        await updateProfile({ display_name: name })
                        setEditingName(false)
                        toast.success('Name updated!')
                      } catch {
                        toast.error('Could not update name')
                      }
                    }}
                    className="px-4 py-2.5 bg-primary rounded-xl text-sm font-semibold text-white active:scale-95 transition-transform"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="px-3 py-2.5 bg-warm-100 dark:bg-stone-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-stone-300"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-warm-400 dark:text-stone-500 text-sm">
                    {profile?.display_name || <span className="italic">Not set</span>}
                  </p>
                  <button
                    onClick={() => { setNameInput(profile?.display_name || ''); setEditingName(true) }}
                    className="text-xs font-semibold text-primary active:scale-95 transition-transform"
                  >
                    Edit
                  </button>
                </div>
              )}
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

          {/* Refresh */}
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-white dark:bg-stone-800 rounded-2xl shadow-card p-4 flex items-center gap-3 active:scale-[0.98] transition-all"
          >
            <div className="w-10 h-10 bg-primary-50 dark:bg-primary/20 rounded-xl flex items-center justify-center">
              <RotateCcw size={18} className="text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-900 dark:text-stone-50 text-sm">Refresh app</p>
              <p className="text-warm-400 dark:text-stone-500 text-xs mt-0.5">Force reload & pick up latest changes</p>
            </div>
          </button>

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

function StoryTab() {
  const { story, save, saving } = useCoupleStory()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [photoUrl, setPhotoUrl] = useState(null)

  const startEdit = () => {
    setDraft(story?.story || '')
    setPhotoUrl(story?.photo_url || null)
    setEditing(true)
  }

  const handleSave = async () => {
    try {
      await save({ story: draft.trim() || null, photo_url: photoUrl })
      setEditing(false)
      toast.success('Saved!')
    } catch {
      toast.error('Could not save')
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="px-5">
        <p className="text-sm text-warm-400 dark:text-stone-500 text-center py-16">
          Our Story needs Supabase connected to sync between you two.
        </p>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="px-5 space-y-4">
        <ThumbnailPicker url={photoUrl} onChange={setPhotoUrl} />
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="How'd you two meet? What's your story?"
          rows={8}
          className="w-full p-4 bg-white dark:bg-stone-800 rounded-2xl shadow-card text-sm text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 outline-none resize-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex gap-3">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 py-3 rounded-2xl bg-warm-100 dark:bg-stone-700 text-sm font-semibold text-gray-700 dark:text-stone-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-primary text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  const hasContent = story?.story || story?.photo_url

  return (
    <div className="px-5 space-y-4">
      {!hasContent ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-3xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-4">
            <BookHeart size={28} className="text-primary" />
          </div>
          <p className="font-semibold text-gray-700 dark:text-stone-300 mb-1">No story yet</p>
          <p className="text-sm text-warm-400 dark:text-stone-500 mb-5">Write down how you two met, or anything worth remembering.</p>
          <button
            onClick={startEdit}
            className="px-5 py-3 bg-primary text-white rounded-2xl font-semibold text-sm active:scale-95 transition-all"
          >
            Write our story
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-card overflow-hidden">
          {story.photo_url && (
            <img src={story.photo_url} alt="Us" className="w-full aspect-[16/9] object-cover" />
          )}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-lg text-gray-900 dark:text-stone-50">Our Story</h3>
              <button onClick={startEdit} className="flex items-center gap-1 text-xs font-semibold text-primary active:scale-95 transition-transform">
                <Pencil size={12} />
                Edit
              </button>
            </div>
            {story.story && (
              <p className="text-sm text-gray-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">{story.story}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CompetitionCard({ entries, myId, partnerId, myName, partnerName }) {
  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = monthStart.toISOString().split('T')[0]

  const thisMonth = entries.filter((e) => e.date >= monthStartStr)
  const myCooks = thisMonth.filter((e) => e.userId === myId).length
  const partnerCooks = thisMonth.filter((e) => e.userId === partnerId).length
  const leader = myCooks > partnerCooks ? myName : partnerCooks > myCooks ? partnerName : null
  const monthLabel = monthStart.toLocaleDateString('en', { month: 'long' })

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-stone-50">{monthLabel} competition</h3>
        {leader && (
          <div className="flex items-center gap-1 text-amber-500">
            <Star size={12} className="fill-amber-500" />
            <span className="text-[11px] font-bold">{leader} is winning</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1 text-center">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-soft">
            <span className="text-white font-bold text-xl">{myName[0]}</span>
          </div>
          <p className="font-bold text-3xl text-gray-900 dark:text-stone-50">{myCooks}</p>
          <p className="text-xs text-warm-400 dark:text-stone-500 mt-0.5">{myName}</p>
        </div>
        <span className="text-xs font-bold text-warm-300 dark:text-stone-600">VS</span>
        <div className="flex-1 text-center">
          <div className="w-14 h-14 bg-sage rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-soft">
            <span className="text-white font-bold text-xl">{partnerName[0]}</span>
          </div>
          <p className="font-bold text-3xl text-gray-900 dark:text-stone-50">{partnerCooks}</p>
          <p className="text-xs text-warm-400 dark:text-stone-500 mt-0.5">{partnerName}</p>
        </div>
      </div>
    </div>
  )
}

function MemoriesCard({ entries }) {
  const withPhotos = entries.filter((e) => e.photoUrl).slice(0, 9)
  if (withPhotos.length === 0) return null

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
      <h3 className="font-semibold text-gray-900 dark:text-stone-50 mb-4">Recent memories</h3>
      <div className="grid grid-cols-3 gap-2">
        {withPhotos.map((entry) => (
          <Link
            key={entry.id}
            to={`/recipe/${entry.recipeId}`}
            className="aspect-square rounded-xl overflow-hidden active:scale-95 transition-transform"
          >
            <img src={entry.photoUrl} alt={entry.recipeTitle} className="w-full h-full object-cover" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function MostCookedCard({ entries, recipes }) {
  const ranked = (() => {
    const counts = {}
    entries.forEach((e) => {
      if (!e.recipeId) return
      counts[e.recipeId] = (counts[e.recipeId] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ recipe: recipes.find((r) => r.id === id), count }))
      .filter((r) => r.recipe)
  })()

  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
      <h3 className="font-semibold text-gray-900 dark:text-stone-50 mb-4">Most cooked</h3>
      {ranked.length === 0 ? (
        <p className="text-warm-400 dark:text-stone-500 text-sm text-center py-4">
          Log your first cook to start tracking.
        </p>
      ) : (
        <div className="space-y-3">
          {ranked.map(({ recipe, count }, i) => (
            <Link key={recipe.id} to={`/recipe/${recipe.id}`} className="flex items-center gap-3 active:scale-[0.98] transition-transform">
              <span className="text-lg w-7 text-center flex-shrink-0">{MEDALS[i] || `${i + 1}`}</span>
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-warm-100 dark:bg-stone-700">
                {recipe.thumbnail_url
                  ? <img src={recipe.thumbnail_url} alt={recipe.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><ChefHat size={14} className="text-warm-300" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-stone-100 truncate">{recipe.title}</p>
                {recipe.rating && <p className="text-xs text-amber-400 mt-0.5">{'★'.repeat(recipe.rating)}</p>}
              </div>
              <span className="text-sm font-bold text-primary flex-shrink-0">{count}×</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function DayPatternsCard({ entries, recipes }) {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const today = new Date().getDay()

  const patterns = DAYS.map((day, dayIndex) => {
    const dayEntries = entries.filter((e) => {
      const d = new Date(e.date + 'T12:00:00')
      return d.getDay() === dayIndex
    })
    if (dayEntries.length < 2) return { day, recipe: null, count: 0 }

    const counts = {}
    dayEntries.forEach((e) => {
      if (e.recipeId) counts[e.recipeId] = (counts[e.recipeId] || 0) + 1
    })
    const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
    return {
      day,
      recipe: recipes.find((r) => r.id === topId) || null,
      count: counts[topId] || 0,
    }
  }).filter((p) => p.recipe && p.count >= 2)

  if (patterns.length === 0) return null

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-card p-5">
      <h3 className="font-semibold text-gray-900 dark:text-stone-50 mb-1">Day patterns</h3>
      <p className="text-xs text-warm-400 dark:text-stone-500 mb-4">What you tend to cook each day</p>
      <div className="space-y-3">
        {patterns.map(({ day, recipe, count }) => {
          const isToday = day === DAYS[today]
          return (
            <Link key={day} to={`/recipe/${recipe.id}`} className={`flex items-center gap-3 active:scale-[0.98] transition-transform ${isToday ? 'opacity-100' : 'opacity-75'}`}>
              <div className={`w-14 text-center flex-shrink-0`}>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? 'text-primary' : 'text-warm-400 dark:text-stone-500'}`}>
                  {day.slice(0, 3)}
                  {isToday && ' ·now'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-warm-100 dark:bg-stone-700">
                {recipe.thumbnail_url
                  ? <img src={recipe.thumbnail_url} alt={recipe.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><ChefHat size={14} className="text-warm-300" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-stone-100 truncate">{recipe.title}</p>
                <p className="text-xs text-warm-400 dark:text-stone-500 mt-0.5">{count}× on {day}s</p>
              </div>
            </Link>
          )
        })}
      </div>
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
