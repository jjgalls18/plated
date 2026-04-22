import { useState } from 'react'
import { ShoppingCart, Plus, Check, X, Share2 } from 'lucide-react'
import { useGrocery } from '../hooks/useGrocery'
import { usePartner } from '../hooks/usePartner'
import { groupByCategory, getCategoryEmoji } from '../lib/grocery'
import PageHeader from '../components/ui/PageHeader'
import toast from 'react-hot-toast'

export default function Grocery() {
  const { items, isLoading, myId, addItem, toggleItem, removeItem, clearChecked, clearAll } = useGrocery()
  const { partner } = usePartner()
  const [newItem, setNewItem] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)
  const groups = groupByCategory(unchecked)

  const partnerName = partner?.display_name || 'Partner'
  const partnerInitial = partnerName[0]?.toUpperCase()

  const handleAdd = (e) => {
    e.preventDefault()
    const name = newItem.trim()
    if (!name) return
    addItem({ name })
    setNewItem('')
  }

  const handleClearChecked = () => {
    clearChecked()
    toast.success('Checked items removed')
  }

  const handleClearAll = () => {
    clearAll()
    setShowClearConfirm(false)
    toast.success('Grocery list cleared')
  }

  const handleShare = async () => {
    const lines = groups.flatMap(({ cat, items: catItems }) => [
      `${getCategoryEmoji(cat)} ${cat}`,
      ...catItems.map((i) => `  • ${i.name}${i.amount ? ` (${i.amount})` : ''}`),
      '',
    ])
    if (checked.length > 0) {
      lines.push('✅ In cart', ...checked.map((i) => `  • ${i.name}`))
    }
    const text = lines.join('\n').trim()

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Grocery List', text })
      } catch (err) {
        if (err.name !== 'AbortError') toast.error('Could not share')
      }
    } else {
      await navigator.clipboard.writeText(text)
      toast.success('List copied to clipboard')
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      <PageHeader />

      <div className="px-5 pb-nav">
        {/* Title row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-stone-50">Grocery List</h1>
            <p className="text-sm text-warm-400 dark:text-stone-500 mt-0.5">
              {isLoading ? 'Loading…' : `${unchecked.length} item${unchecked.length !== 1 ? 's' : ''} to get`}
              {partner && <span className="ml-1.5 text-primary font-medium">· shared with {partnerName}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <button onClick={handleShare} className="p-2 text-warm-400 dark:text-stone-500 hover:text-primary transition-colors">
                <Share2 size={18} />
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-warm-400 dark:text-stone-500 hover:text-red-500 transition-colors font-medium"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Add item form */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add an item..."
            className="flex-1 px-4 py-3 bg-white dark:bg-stone-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-primary/30 shadow-card transition-all"
          />
          <button
            type="submit"
            className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-soft active:scale-90 transition-transform"
          >
            <Plus size={20} className="text-white" />
          </button>
        </form>

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-3xl bg-warm-100 dark:bg-stone-800 flex items-center justify-center mb-4">
              <ShoppingCart size={28} className="text-warm-300 dark:text-stone-600" />
            </div>
            <p className="font-semibold text-gray-700 dark:text-stone-300 mb-1">Nothing here yet</p>
            <p className="text-sm text-warm-400 dark:text-stone-500">Add items above or tap "Add to grocery list" on any recipe</p>
          </div>
        )}

        {/* Grouped unchecked items */}
        {groups.map(({ cat, items: catItems }) => (
          <div key={cat} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{getCategoryEmoji(cat)}</span>
              <p className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide">{cat}</p>
            </div>
            <div className="space-y-2">
              {catItems.map((item) => (
                <GroceryItem
                  key={item.id}
                  item={item}
                  myId={myId}
                  partnerInitial={partnerInitial}
                  onToggle={() => toggleItem(item.id, item.checked)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Checked / in cart */}
        {checked.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide">
                ✅ In cart ({checked.length})
              </p>
              <button
                onClick={handleClearChecked}
                className="text-xs text-warm-400 dark:text-stone-500 hover:text-primary transition-colors font-medium"
              >
                Remove checked
              </button>
            </div>
            <div className="space-y-2 opacity-60">
              {checked.map((item) => (
                <GroceryItem
                  key={item.id}
                  item={item}
                  myId={myId}
                  partnerInitial={partnerInitial}
                  onToggle={() => toggleItem(item.id, item.checked)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clear all confirm */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pb-10 px-5">
          <div className="w-full max-w-sm bg-white dark:bg-stone-800 rounded-3xl p-6 shadow-xl">
            <h3 className="font-semibold text-gray-900 dark:text-stone-50 text-lg mb-2">Clear everything?</h3>
            <p className="text-sm text-warm-400 dark:text-stone-400 mb-5">This will remove all items from your shared grocery list.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3 rounded-2xl bg-warm-100 dark:bg-stone-700 text-sm font-semibold text-gray-700 dark:text-stone-200">
                Cancel
              </button>
              <button onClick={handleClearAll} className="flex-1 py-3 rounded-2xl bg-red-500 text-sm font-semibold text-white">
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GroceryItem({ item, myId, partnerInitial, onToggle, onRemove }) {
  const addedByPartner = myId && item.user_id && item.user_id !== myId

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-stone-800 rounded-2xl px-4 py-3.5 shadow-card">
      <button
        onClick={onToggle}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
          item.checked ? 'bg-primary border-primary' : 'border-warm-300 dark:border-stone-600'
        }`}
      >
        {item.checked && <Check size={12} className="text-white" strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium text-gray-900 dark:text-stone-50 truncate ${item.checked ? 'line-through text-warm-400 dark:text-stone-500' : ''}`}>
          {item.name}
        </p>
        {item.amount && (
          <p className="text-xs text-warm-400 dark:text-stone-500 mt-0.5">{item.amount}</p>
        )}
      </div>

      {/* Partner badge */}
      {addedByPartner && partnerInitial && (
        <div className="w-5 h-5 rounded-full bg-sage flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[9px] font-bold">{partnerInitial}</span>
        </div>
      )}

      <button
        onClick={onRemove}
        className="p-1.5 text-warm-300 dark:text-stone-600 hover:text-red-400 transition-colors active:scale-90"
      >
        <X size={15} />
      </button>
    </div>
  )
}
