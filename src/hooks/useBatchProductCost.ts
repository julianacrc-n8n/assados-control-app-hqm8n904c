import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { listRecipeItemsForProducts } from '@/services/recipe-items'
import { getLatestPurchaseItemsByIngredients } from '@/services/purchase-items'
import { useIngredients } from '@/hooks/useIngredients'
import { computeProductCost, computeMargin } from '@/lib/cost'
import type { CostSummary, Product, PurchaseItem, RecipeItem } from '@/types'

export interface UseBatchProductCost {
  productCosts: Map<string, CostSummary>
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * useBatchProductCost — computes the production cost + margin for every
 * product in `products` using at most two batched queries (one for all
 * recipe_items of the page, one for the latest purchase_item per unique
 * ingredient). Avoids the N+1 that per-row `useProductCost` would cause in
 * the products table.
 */
export function useBatchProductCost(products: Product[]): UseBatchProductCost {
  const { ingredients } = useIngredients()
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([])
  const [latestCostMap, setLatestCostMap] = useState<Map<string, PurchaseItem>>(new Map())
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

  const productIds = useMemo(() => products.map((p) => p.id), [products])
  const productIdsKey = productIds.join(',')

  useEffect(() => {
    if (productIds.length === 0) {
      setRecipeItems([])
      setLatestCostMap(new Map())
      setError(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const items = await listRecipeItemsForProducts(productIds)
        if (!active) return
        const ingredientIds = Array.from(new Set(items.map((r) => r.ingredientId)))
        const costs = await getLatestPurchaseItemsByIngredients(ingredientIds)
        if (!active) return
        setRecipeItems(items)
        setLatestCostMap(costs)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao calcular custos.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdsKey, tick])

  // Build the per-product cost summary map from the fetched recipe items +
  // latest cost map. Recomputed locally (no refetch) whenever the inputs
  // change — including product prices, which may update via realtime.
  const productCosts = useMemo(() => {
    const ingredientMap = new Map(ingredients.map((i) => [i.id, i]))
    const byProduct = new Map<string, RecipeItem[]>()
    for (const ri of recipeItems) {
      const arr = byProduct.get(ri.productId) ?? []
      arr.push(ri)
      byProduct.set(ri.productId, arr)
    }
    const result = new Map<string, CostSummary>()
    for (const product of products) {
      const items = byProduct.get(product.id) ?? []
      if (items.length === 0) {
        // No recipe → no cost.
        result.set(product.id, {
          productId: product.id,
          totalCost: null,
          margin: null,
        })
        continue
      }
      const { totalCost, hasPartialCost } = computeProductCost(items, ingredientMap, latestCostMap)
      result.set(product.id, {
        productId: product.id,
        totalCost,
        margin: computeMargin(product.price, totalCost),
        hasPartialCost,
      })
    }
    return result
  }, [products, recipeItems, latestCostMap, ingredients])

  return {
    productCosts,
    loading,
    error,
    refetch,
  }
}
