import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { MOCK_RECIPES } from '../data/mockRecipes'

// Local mock storage for demo mode
const getMockRecipes = () => {
  try {
    const stored = localStorage.getItem('plated-mock-recipes')
    return stored ? JSON.parse(stored) : MOCK_RECIPES
  } catch {
    return MOCK_RECIPES
  }
}

const saveMockRecipes = (recipes) => {
  localStorage.setItem('plated-mock-recipes', JSON.stringify(recipes))
}

// --- Fetch all recipes ---
export function useRecipes(search = '') {
  return useQuery({
    queryKey: ['recipes', search],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        const recipes = getMockRecipes()
        if (!search) return recipes
        const q = search.toLowerCase()
        return recipes.filter(
          (r) => r.title.toLowerCase().includes(q) || r.tags?.some((t) => t.includes(q))
        )
      }

      let query = supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false })

      if (search) {
        query = query.ilike('title', `%${search}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

// --- Fetch single recipe ---
export function useRecipe(id) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return getMockRecipes().find((r) => r.id === id) ?? null
      }
      const { data, error } = await supabase.from('recipes').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

// --- Add recipe ---
export function useAddRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (recipe) => {
      if (!isSupabaseConfigured) {
        const recipes = getMockRecipes()
        const newRecipe = {
          ...recipe,
          id: `local-${Date.now()}`,
          made_count: 0,
          created_at: new Date().toISOString(),
        }
        saveMockRecipes([newRecipe, ...recipes])
        return newRecipe
      }

      const { data, error } = await supabase.from('recipes').insert(recipe).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}

// --- Update recipe ---
export function useUpdateRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      if (!isSupabaseConfigured) {
        const recipes = getMockRecipes()
        const updated = recipes.map((r) => (r.id === id ? { ...r, ...updates } : r))
        saveMockRecipes(updated)
        return updated.find((r) => r.id === id)
      }
      const { data, error } = await supabase.from('recipes').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['recipes'] })
      qc.invalidateQueries({ queryKey: ['recipe', data?.id] })
    },
  })
}

// --- Delete recipe ---
export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      if (!isSupabaseConfigured) {
        const recipes = getMockRecipes()
        saveMockRecipes(recipes.filter((r) => r.id !== id))
        return id
      }
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}

// --- Similar recipes by shared proteins / key ingredients ---
const PROTEIN_KEYWORDS = [
  'chicken', 'beef', 'pork', 'salmon', 'shrimp', 'turkey', 'lamb', 'tuna',
  'cod', 'tilapia', 'crab', 'lobster', 'scallop', 'bacon', 'sausage', 'ham',
  'fish', 'steak', 'ground beef', 'ground turkey', 'ground pork',
]
const MAIN_KEYWORDS = [
  'pasta', 'rice', 'noodle', 'potato', 'lentil', 'chickpea', 'tofu',
  'egg', 'mushroom', 'tomato', 'spinach', 'broccoli',
]

function extractKeywords(recipe) {
  const text = [
    recipe.title,
    ...(recipe.ingredients?.map((i) => i.name) || []),
    ...(recipe.tags || []),
  ].join(' ').toLowerCase()

  const found = new Set()
  for (const kw of [...PROTEIN_KEYWORDS, ...MAIN_KEYWORDS]) {
    if (text.includes(kw)) found.add(kw)
  }
  return found
}

export function useSimilarRecipes(recipe) {
  const { data: allRecipes = [] } = useRecipes()
  if (!recipe) return []

  const currentKws = extractKeywords(recipe)
  if (currentKws.size === 0) return []

  return allRecipes
    .filter((r) => r.id !== recipe.id)
    .map((r) => {
      const kws = extractKeywords(r)
      const shared = [...currentKws].filter((k) => kws.has(k))
      return { recipe: r, score: shared.length }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ recipe: r }) => r)
}

// --- Log "made it" ---
export function useLogMadeIt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ recipeId, rating, notes }) => {
      if (!isSupabaseConfigured) {
        const recipes = getMockRecipes()
        const updated = recipes.map((r) =>
          r.id === recipeId
            ? { ...r, made_count: (r.made_count || 0) + 1, rating: rating || r.rating }
            : r
        )
        saveMockRecipes(updated)
        return { recipeId, rating }
      }
      const { error } = await supabase.from('made_it_log').insert({ recipe_id: recipeId, rating, notes })
      if (error) throw error
      const { error: err2 } = await supabase.rpc('increment_made_count', { recipe_id: recipeId })
      if (err2) throw err2
      if (rating) {
        await supabase.from('recipes').update({ rating }).eq('id', recipeId)
      }
      return { recipeId, rating }
    },
    onSuccess: (_data, { recipeId }) => {
      qc.invalidateQueries({ queryKey: ['recipes'] })
      qc.invalidateQueries({ queryKey: ['recipe', recipeId] })
    },
  })
}
