import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Check, PartyPopper } from 'lucide-react'
import { useGrocery } from '../hooks/useGrocery'
import { groupByCategory, getCategoryEmoji } from '../lib/grocery'

export default function ShopMode() {
  const navigate = useNavigate()
  const { items, toggleItem } = useGrocery()
  const [justChecked, setJustChecked] = useState(null)

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)
  const groups = groupByCategory(unchecked)
  const total = items.length
  const done = checked.length

  const handleToggle = (item) => {
    if (!item.checked) setJustChecked(item.id)
    toggleItem(item.id, item.checked)
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-cream/95 dark:bg-stone-900/95 backdrop-blur-sm px-5 pt-14 pb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate('/grocery')}
            className="w-10 h-10 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card"
          >
            <X size={20} className="text-gray-700 dark:text-stone-300" />
          </button>
          <p className="font-display text-lg font-bold text-gray-900 dark:text-stone-50">Shop Mode</p>
          <div className="w-10" />
        </div>
        {total > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-warm-200 dark:bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
            <p className="text-sm font-bold text-gray-700 dark:text-stone-300 whitespace-nowrap">
              {done} / {total}
            </p>
          </div>
        )}
      </div>

      <div className="px-5 pb-16">
        {total === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-4xl mb-3">🛒</p>
            <p className="font-semibold text-gray-700 dark:text-stone-300">Nothing on the list</p>
          </div>
        )}

        {total > 0 && unchecked.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <PartyPopper size={40} className="text-primary mb-3" />
            <p className="font-display text-xl font-bold text-gray-900 dark:text-stone-50">That&apos;s everything!</p>
            <p className="text-sm text-warm-400 dark:text-stone-500 mt-1">Nice work, all {total} items checked off.</p>
            <button
              onClick={() => navigate('/grocery')}
              className="mt-6 px-6 py-3 bg-primary text-white rounded-2xl font-semibold text-sm active:scale-95 transition-all"
            >
              Done shopping
            </button>
          </div>
        )}

        {groups.map(({ cat, items: catItems }) => (
          <div key={cat} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{getCategoryEmoji(cat)}</span>
              <p className="text-base font-bold text-gray-800 dark:text-stone-200 uppercase tracking-wide">{cat}</p>
            </div>
            <div className="space-y-2.5">
              {catItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleToggle(item)}
                  className={`w-full flex items-center gap-4 bg-white dark:bg-stone-800 rounded-2xl px-5 py-4 shadow-card text-left active:scale-[0.98] transition-all ${
                    justChecked === item.id ? 'animate-fade-up' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full border-[3px] border-warm-300 dark:border-stone-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-gray-900 dark:text-stone-50 leading-snug">{item.name}</p>
                    {item.amount && (
                      <p className="text-sm text-warm-400 dark:text-stone-500 mt-0.5">{item.amount}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        {checked.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-3">
              In cart ({checked.length})
            </p>
            <div className="space-y-2">
              {checked.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleToggle(item)}
                  className="w-full flex items-center gap-3 opacity-50 active:scale-[0.98] transition-all px-1 py-1.5 text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check size={13} className="text-white" strokeWidth={3} />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-stone-300 line-through truncate">
                    {item.name}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
