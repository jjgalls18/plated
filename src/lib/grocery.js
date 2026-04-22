export const CATEGORIES = [
  {
    name: 'Meat & Seafood',
    emoji: '🥩',
    keywords: ['chicken', 'beef', 'pork', 'salmon', 'fish', 'shrimp', 'turkey', 'lamb', 'bacon',
      'sausage', 'steak', 'ground', 'breast', 'thigh', 'wing', 'rib', 'tuna', 'cod', 'tilapia',
      'crab', 'lobster', 'scallop', 'anchovy', 'prosciutto', 'ham', 'pepperoni', 'chorizo'],
  },
  {
    name: 'Produce',
    emoji: '🥦',
    keywords: ['onion', 'garlic', 'tomato', 'lettuce', 'spinach', 'pepper', 'broccoli', 'carrot',
      'celery', 'cucumber', 'zucchini', 'mushroom', 'potato', 'sweet potato', 'kale', 'arugula',
      'cabbage', 'corn', 'pea', 'bean', 'asparagus', 'eggplant', 'cauliflower', 'leek', 'shallot',
      'ginger', 'herb', 'basil', 'cilantro', 'parsley', 'thyme', 'rosemary', 'mint', 'chive',
      'scallion', 'green onion', 'jalapeño', 'avocado', 'lime', 'lemon', 'apple', 'banana',
      'berry', 'strawberry', 'blueberry', 'raspberry', 'grape', 'mango', 'pineapple', 'peach',
      'pear', 'orange', 'grapefruit', 'cherry', 'watermelon', 'melon'],
  },
  {
    name: 'Dairy & Eggs',
    emoji: '🧀',
    keywords: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'egg', 'sour cream', 'parmesan',
      'mozzarella', 'cheddar', 'ricotta', 'feta', 'brie', 'gouda', 'whipping cream', 'half and half',
      'buttermilk', 'ghee', 'cream cheese'],
  },
  {
    name: 'Bakery & Bread',
    emoji: '🍞',
    keywords: ['bread', 'roll', 'bun', 'baguette', 'tortilla', 'pita', 'naan', 'croissant',
      'bagel', 'muffin', 'wrap'],
  },
  {
    name: 'Pantry & Dry Goods',
    emoji: '🫙',
    keywords: ['flour', 'sugar', 'salt', 'pepper', 'oil', 'olive oil', 'vinegar', 'pasta', 'rice',
      'quinoa', 'oat', 'cereal', 'lentil', 'chickpea', 'can', 'canned', 'sauce', 'tomato sauce',
      'broth', 'stock', 'bouillon', 'honey', 'maple', 'syrup', 'jam', 'peanut butter', 'nut',
      'almond', 'walnut', 'cashew', 'seed', 'breadcrumb', 'cornstarch', 'baking', 'yeast',
      'cocoa', 'chocolate', 'vanilla', 'spice', 'cumin', 'paprika', 'turmeric', 'cinnamon',
      'oregano', 'bay leaf', 'soy sauce', 'fish sauce', 'hot sauce', 'mustard', 'ketchup',
      'mayonnaise', 'worcestershire', 'coconut milk', 'tahini', 'miso', 'noodle'],
  },
  {
    name: 'Frozen',
    emoji: '🧊',
    keywords: ['frozen', 'ice cream', 'ice', 'edamame', 'frozen pea', 'frozen corn'],
  },
  {
    name: 'Beverages',
    emoji: '🥤',
    keywords: ['juice', 'water', 'wine', 'beer', 'soda', 'coffee', 'tea', 'sparkling', 'drink'],
  },
]

export const OTHER_CATEGORY = { name: 'Other', emoji: '🛒' }

export function detectCategory(itemName) {
  const lower = itemName?.toLowerCase() || ''
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) return cat.name
  }
  return OTHER_CATEGORY.name
}

export function getCategoryEmoji(catName) {
  return CATEGORIES.find((c) => c.name === catName)?.emoji || OTHER_CATEGORY.emoji
}

export function groupByCategory(items) {
  const groups = {}
  for (const item of items) {
    const cat = item.category && item.category !== 'Recipe' ? item.category : detectCategory(item.name)
    if (!groups[cat]) groups[cat] = []
    groups[cat].push({ ...item, resolvedCategory: cat })
  }
  const order = CATEGORIES.map((c) => c.name).concat([OTHER_CATEGORY.name])
  return order.filter((cat) => groups[cat]).map((cat) => ({ cat, items: groups[cat] }))
}
