/**
 * Orderings for the recipe list. Pure, so tests/ can run it under Node.
 *
 * Every comparator falls back to newest-first, so recipes that tie (or have
 * no value at all — no rating yet, no times entered) keep a stable, sensible
 * order instead of shuffling between renders.
 */

const newest = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))

const totalTime = (r) => (r.prep_time || 0) + (r.cook_time || 0)

export const SORTS = [
  { id: 'newest', label: 'Newest', compare: newest },
  {
    id: 'az',
    label: 'A to Z',
    compare: (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }) || newest(a, b),
  },
  {
    id: 'most-cooked',
    label: 'Most cooked',
    compare: (a, b) => (b.made_count || 0) - (a.made_count || 0) || newest(a, b),
  },
  {
    id: 'top-rated',
    label: 'Top rated',
    compare: (a, b) => (b.rating || 0) - (a.rating || 0) || newest(a, b),
  },
  {
    id: 'quickest',
    label: 'Quickest',
    // Recipes with no time recorded go last rather than first: "0 minutes"
    // means unknown, not instant.
    compare: (a, b) => (totalTime(a) || Infinity) - (totalTime(b) || Infinity) || newest(a, b),
  },
  {
    id: 'never-made',
    label: 'Not made yet',
    compare: (a, b) => (a.made_count || 0) - (b.made_count || 0) || newest(a, b),
  },
]

export function sortRecipes(recipes, sortId = 'newest') {
  const sort = SORTS.find((s) => s.id === sortId) || SORTS[0]
  return [...recipes].sort(sort.compare)
}
