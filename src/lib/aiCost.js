/**
 * Token pricing lives in shared/ so the homelab worker costs an extraction the
 * same way the browser does — the admin panel's totals are meaningless if the
 * two disagree. Re-exported from here because that's where the app imports it.
 */
export { computeCost } from '../../shared/recipePrompt.js'
