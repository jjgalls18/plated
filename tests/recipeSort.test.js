import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SORTS, sortRecipes } from '../src/lib/recipeSort.js'

const recipes = [
  { id: 'a', title: 'Zucchini Bread', created_at: '2026-01-01', made_count: 5, rating: 3, prep_time: 10, cook_time: 50 },
  { id: 'b', title: 'apple pie', created_at: '2026-03-01', made_count: 0, rating: 5, prep_time: 30, cook_time: 45 },
  { id: 'c', title: 'Miso Soup', created_at: '2026-02-01', made_count: 2, rating: null, prep_time: 5, cook_time: 10 },
  { id: 'd', title: 'Mystery Dish', created_at: '2026-04-01' },
]
const ids = (sortId) => sortRecipes(recipes, sortId).map((r) => r.id).join('')

test('each ordering', () => {
  assert.equal(ids('newest'), 'dbca')
  assert.equal(ids('az'), 'bcda')
  assert.equal(ids('most-cooked'), 'acdb')
  assert.equal(ids('top-rated'), 'badc')
  assert.equal(ids('quickest'), 'cabd') // no time recorded goes last
  assert.equal(ids('never-made'), 'dbca')
})

test('unknown sort falls back to newest and the input is not mutated', () => {
  assert.equal(ids('nonsense'), 'dbca')
  assert.equal(recipes.map((r) => r.id).join(''), 'abcd')
})

test('every sort has a label', () => {
  for (const s of SORTS) assert.ok(s.id && s.label && typeof s.compare === 'function')
})
