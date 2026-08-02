// Published per-million-token USD pricing (standard rate, not promotional).
const PRICING = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-sonnet-5': { input: 3.0, output: 15.0 },
}

export function computeCost(model, usage) {
  const price = PRICING[model]
  if (!price || !usage) return 0
  const inputCost = ((usage.input_tokens || 0) / 1_000_000) * price.input
  const outputCost = ((usage.output_tokens || 0) / 1_000_000) * price.output
  return inputCost + outputCost
}
