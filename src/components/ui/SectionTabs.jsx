import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useRecipes } from '../../hooks/useRecipes'
import { useGrocery } from '../../hooks/useGrocery'

/**
 * Top-level tabs for the Recipes section, rendered on both /recipes and
 * /grocery so the three read as one place. The grocery list used to sit under
 * "Us", which is not where you look for it while deciding what to cook.
 *
 * Which tab is active comes from the URL rather than local state, so the bar
 * works identically on either page — "Our Cookbook" is /recipes?view=cookbook.
 */
export default function SectionTabs() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // useGrocery hands every caller its own realtime channel by design, so
  // mounting this alongside the Grocery page's own copy is safe.
  const { data: recipes = [] } = useRecipes('')
  const { items: groceryItems = [] } = useGrocery()

  const favorites = recipes.filter((r) => r.is_favorite).length
  const toGet = groceryItems.filter((i) => !i.checked).length

  const active = location.pathname.startsWith('/grocery')
    ? 'grocery'
    : searchParams.get('view') === 'cookbook'
      ? 'cookbook'
      : 'all'

  const tabs = [
    { key: 'all', label: 'All Recipes', to: '/recipes' },
    { key: 'grocery', label: toGet ? `Grocery (${toGet})` : 'Grocery', to: '/grocery' },
    { key: 'cookbook', label: favorites ? `Our Cookbook (${favorites})` : 'Our Cookbook', to: '/recipes?view=cookbook' },
  ]

  return (
    <div className="flex bg-white dark:bg-stone-800 rounded-2xl shadow-card p-1">
      {tabs.map(({ key, label, to }) => (
        <button
          key={key}
          onClick={() => navigate(to)}
          className={`flex-1 min-w-0 px-1 py-2 rounded-xl text-[11px] font-semibold truncate transition-all ${
            active === key ? 'bg-primary text-white shadow-soft' : 'text-warm-400 dark:text-stone-500'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
