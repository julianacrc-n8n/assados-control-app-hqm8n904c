/**
 * Pure helpers for computing a product's production cost from its recipe
 * items plus the latest known purchase unit cost per ingredient.
 *
 * Kept framework-agnostic so both the single-product hook and the batch
 * hook share one definition of "cost".
 */

import type { Ingredient, PurchaseItem, RecipeItem, CostLine } from '@/types'

export interface CostComputation {
  lines: CostLine[]
  totalCost: number | null
  /** At least one ingredient has a known cost AND at least one does not. */
  hasPartialCost: boolean
}

/**
 * Build cost lines and the total cost from a list of recipe items.
 *
 * @param recipeItems   the recipe items for a single product
 * @param ingredientMap a Map<ingredientId, Ingredient> used to resolve name/unit
 * @param latestCostMap a Map<ingredientId, PurchaseItem> of the newest purchase
 *                      item per ingredient (only ingredients with a purchase)
 * @returns lines (one per recipe item) and totalCost (sum of non-null line
 *          costs, or null when every line has a null unit cost)
 */
export function computeProductCost(
  recipeItems: RecipeItem[],
  ingredientMap: Map<string, Ingredient>,
  latestCostMap: Map<string, PurchaseItem>,
): CostComputation {
  const lines: CostLine[] = recipeItems.map((item) => {
    const ing = ingredientMap.get(item.ingredientId)
    const latest = latestCostMap.get(item.ingredientId)
    const unitCost = latest ? latest.unitCost : null
    const lineCost = unitCost !== null ? item.quantity * unitCost : null
    return {
      ingredientId: item.ingredientId,
      ingredientName: ing?.name ?? 'Insumo removido',
      unit: ing?.unit ?? '',
      quantity: item.quantity,
      unitCost,
      lineCost,
    }
  })

  const knownLines = lines.filter((l) => l.lineCost !== null)
  const unknownLines = lines.length - knownLines.length
  const totalCost =
    knownLines.length > 0 ? knownLines.reduce((sum, l) => sum + (l.lineCost ?? 0), 0) : null
  const hasPartialCost = knownLines.length > 0 && unknownLines > 0

  return { lines, totalCost, hasPartialCost }
}

/**
 * Profit margin (%) for a selling price and a cost.
 * Returns null when cost is null or price is not a positive number.
 */
export function computeMargin(price: number, totalCost: number | null): number | null {
  if (totalCost === null) return null
  if (!Number.isFinite(price) || price <= 0) return null
  return ((price - totalCost) / price) * 100
}
