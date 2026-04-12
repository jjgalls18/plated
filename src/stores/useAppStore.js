import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export function calculateAiCosts(aiCostLog = []) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const sum = (entries) => entries.reduce((s, e) => s + e.cost, 0)
  return {
    today: sum(aiCostLog.filter((e) => e.ts >= todayStart)),
    week:  sum(aiCostLog.filter((e) => e.ts >= weekStart)),
    month: sum(aiCostLog.filter((e) => e.ts >= monthStart)),
  }
}

export function calculateStreak(cookedDates = []) {
  if (cookedDates.length === 0) return 0
  const unique = [...new Set(cookedDates)].sort().reverse()
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (unique[0] !== today && unique[0] !== yesterday) return 0
  let count = 1
  for (let i = 1; i < unique.length; i++) {
    const expected = new Date(new Date(unique[i - 1]).getTime() - 86400000)
      .toISOString().split('T')[0]
    if (unique[i] === expected) count++
    else break
  }
  return count
}

export const useAppStore = create(
  persist(
    (set) => ({
      // Theme
      darkMode: false,
      setDarkMode: (dark) => set({ darkMode: dark }),

      // AI settings
      aiEnabled: false,
      anthropicApiKey: '',
      setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
      setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),

      // Cooked dates for streak tracking (YYYY-MM-DD strings)
      cookedDates: [],
      addCookedDate: () => set((s) => {
        const today = new Date().toISOString().split('T')[0]
        if (s.cookedDates.includes(today)) return {}
        return { cookedDates: [today, ...s.cookedDates].slice(0, 365) }
      }),

      // Per-person cook log — [{ date, person, recipeId, recipeTitle, recipeThumbnail }]
      cookLog: [],
      logCook: ({ person, recipeId, recipeTitle, recipeThumbnail }) => set((s) => {
        const today = new Date().toISOString().split('T')[0]
        const cookedDates = s.cookedDates.includes(today)
          ? s.cookedDates
          : [today, ...s.cookedDates].slice(0, 365)
        return {
          cookLog: [{ date: today, person, recipeId, recipeTitle, recipeThumbnail }, ...s.cookLog].slice(0, 500),
          cookedDates,
        }
      }),

      // Meal plan — { 'YYYY-MM-DD': recipeId }
      mealPlan: {},
      setMealPlan: (date, recipeId) => set((s) => ({ mealPlan: { ...s.mealPlan, [date]: recipeId } })),
      removeMealPlan: (date) => set((s) => { const p = { ...s.mealPlan }; delete p[date]; return { mealPlan: p } }),

      // Grocery list (local cache)
      groceryItems: [],
      addGroceryItem: (item) => set((s) => ({
        groceryItems: [...s.groceryItems, { id: Date.now().toString(), checked: false, ...item }],
      })),
      toggleGroceryItem: (id) => set((s) => ({
        groceryItems: s.groceryItems.map((i) => i.id === id ? { ...i, checked: !i.checked } : i),
      })),
      removeGroceryItem: (id) => set((s) => ({
        groceryItems: s.groceryItems.filter((i) => i.id !== id),
      })),
      clearCheckedItems: () => set((s) => ({
        groceryItems: s.groceryItems.filter((i) => !i.checked),
      })),
      clearGroceryList: () => set({ groceryItems: [] }),
      clearCookedDates: () => set({ cookedDates: [] }),

      // AI cost tracking — each entry: { ts, cost (USD), feature }
      aiCostLog: [],
      logAiCost: (cost, feature = 'other') => set((s) => ({
        aiCostLog: [...s.aiCostLog, { ts: Date.now(), cost, feature }].slice(-2000),
      })),
      clearAiCostLog: () => set({ aiCostLog: [] }),

      // Grocery list generation counter
      groceryListsGenerated: 0,
      incrementGroceryListsGenerated: () => set((s) => ({ groceryListsGenerated: s.groceryListsGenerated + 1 })),
    }),
    {
      name: 'plated-app-store',
      partialize: (state) => ({
        darkMode: state.darkMode,
        aiEnabled: state.aiEnabled,
        anthropicApiKey: state.anthropicApiKey,
        groceryItems: state.groceryItems,
        cookedDates: state.cookedDates,
        cookLog: state.cookLog,
        mealPlan: state.mealPlan,
        aiCostLog: state.aiCostLog,
        groceryListsGenerated: state.groceryListsGenerated,
      }),
    }
  )
)
