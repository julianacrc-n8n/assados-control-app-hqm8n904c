import { useCallback, useEffect, useRef, useState } from 'react'

import { listRecipeItems } from '@/services/recipe-items'
import { getLatestPurchaseItemByIngredient } from '@/services/purchase-items'
import { useIngredients } from '@/hooks/useIngredients'
import { computeProductCost, computeMargin } from '@/lib/cost'
import type { CostLine, PurchaseItem } from '@/types'

export interface UseProductCost {
  costBreakdown: CostLine[]
  totalCost: number | null
  margin: number | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * useProductCost — calculates the production cost of a single product based
 * on its recipe_items and the latest known purchase unit cost per ingredient.
 *
 * Pass `productId = null` (or an empty string) to skip fetching (e.g. in
 * create mode). Pass a `price` so `margin` can be computed alongside the
 * cost. The hook refetches whenever `productId` or a `refetchKey` changes
 * (the latter lets the recipe editor force a refresh after an ingredient is
 * added/removed). The margin is recomputed locally whenever `price`
 * changes without re-fetching.
 */
export function useProductCost(
  productId: string | null,
  price: number,
  refetchKey?: unknown,
): UseProductCost {
  const { ingredients } = useIngredients()
  const [costBreakdown, setCostBreakdown] = useState<CostLine[]>([])
  const [totalCost, setTotalCost] = useState<number | null>(null)
  const [margin, setMargin] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  // Fetch cost breakdown + total cost whenever the product or recipe changes.
  useEffect(() => {
    if (!productId) {
      setCostBreakdown([])
      setTotalCost(null)
      setError(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const recipeItems = await listRecipeItems(productId)
        if (!active) return
        const ingredientIds = Array.from(new Set(recipeItems.map((r) => r.ingredientId)))
        const latestCostMap = new Map<string, PurchaseItem>()
        await Promise.all(
          ingredientIds.map(async (id) => {
            const latest = await getLatestPurchaseItemByIngredient(id)
            if (latest) latestCostMap.set(id, latest)
          }),
        )
        if (!active) return

        const ingredientMap = new Map(ingredients.map((i) => [i.id, i]))
        const { lines, totalCost: tc } = computeProductCost(
          recipeItems,
          ingredientMap,
          latestCostMap,
        )
        if (!active) return
        setCostBreakdown(lines)
        setTotalCost(tc)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível calcular o custo.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, tick, refetchKey])

  // Recompute margin locally whenever price or totalCost changes — no refetch.
  useEffect(() => {
    setMargin(computeMargin(price, totalCost))
  }, [price, totalCost])

  return {
    costBreakdown,
    totalCost,
    margin,
    loading,
    error,
    refetch,
  }
}
