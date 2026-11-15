import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findStepTimes, formatDuration, scaleAmount } from '../src/lib/cooking.js'

const secs = (text) => findStepTimes(text).map((t) => t.seconds)

test('finds a plain minute count', () => {
  assert.deepEqual(secs('Fry until crisp, about 8 minutes.'), [480])
})

test('a range starts at its lower bound', () => {
  assert.deepEqual(secs('Bake for 10-12 minutes'), [600])
  assert.deepEqual(secs('Simmer 30 to 45 min'), [1800])
})

test('hours, fractions and compound times', () => {
  assert.deepEqual(secs('Roast for 1 1/2 hours'), [5400])
  assert.deepEqual(secs('Cook 1 hour 15 minutes'), [4500])
  assert.deepEqual(secs('Rest for 1/2 hour'), [1800])
  assert.deepEqual(secs('Sear 30 seconds per side'), [30])
})

test('several times in one step, de-duplicated, capped at three', () => {
  assert.deepEqual(secs('Boil 5 minutes, then simmer 20 minutes, rest 5 minutes'), [300, 1200])
  assert.equal(findStepTimes('1 min, 2 min, 3 min, 4 min').length, 3)
})

test('ignores things that are not times', () => {
  assert.deepEqual(secs('Preheat the oven to 400 degrees.'), [])
  assert.deepEqual(secs('Add 2 cups of flour and 3 eggs.'), [])
  assert.deepEqual(secs('Use 500 g of mince and 2 medium onions.'), [])
  assert.deepEqual(secs('Add 200 ml stock and 3 small potatoes'), [])
  assert.deepEqual(secs(''), [])
  assert.deepEqual(secs(null), [])
})

test('labels read naturally', () => {
  assert.equal(formatDuration(480), '8 min')
  assert.equal(formatDuration(5400), '1 hr 30 min')
  assert.equal(formatDuration(30), '30 sec')
  assert.equal(formatDuration(90), '1 min 30 sec')
})

test('scaleAmount scales the number and keeps the unit', () => {
  assert.equal(scaleAmount('2 cups', 2), '4 cups')
  assert.equal(scaleAmount('1/2 tsp', 2), '1 tsp')
  assert.equal(scaleAmount('200g', 0.5), '100g')
  assert.equal(scaleAmount('1-2 cloves', 2), '2-4 cloves')
  assert.equal(scaleAmount('pinch', 3), 'pinch')
  assert.equal(scaleAmount('2 cups', 1), '2 cups')
  assert.equal(scaleAmount(null, 2), null)
})

test('scaleAmount reads mixed numbers and unicode fractions', () => {
  assert.equal(scaleAmount('1 1/2 cups', 2), '3 cups')
  assert.equal(scaleAmount('½ cup', 1.5), '3/4 cup')
  assert.equal(scaleAmount('1½ cups', 2), '3 cups')
  assert.equal(scaleAmount('¼ tsp', 2), '1/2 tsp')
})

test('scaleAmount writes results as kitchen fractions', () => {
  assert.equal(scaleAmount('1 cup', 1.5), '1 1/2 cup')
  assert.equal(scaleAmount('1 cup', 0.5), '1/2 cup')
  assert.equal(scaleAmount('1/3 cup', 2), '2/3 cup')
  assert.equal(scaleAmount('3 eggs', 1.5), '4 1/2 eggs')
  assert.equal(scaleAmount('100 g', 1.07), '107 g')
  assert.equal(scaleAmount('1 tbsp', 0.3), '0.3 tbsp')
})
