import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import {
  createProduct as createProductService,
  deleteProduct as deleteProductService,
  listProducts,
  updateProduct as updateProductService,
} from '@/services/products'
import {
  createRecipeItem as createRecipeItemService,
  deleteRecipeItem as deleteRecipeItemService,
  listRecipeItems,
} from '@/services/recipe-items'
import { mapProduct } from '@/lib/pocketbase/maps'
import type { Product, ProductInput, RecipeItem, RecipeItemInput } from '@/types'

export interface UseProducts {
  products: Product[]
  loading: boolean
  error: string | null
  refetch: () => void
  createProduct: (input: ProductInput) => Promise<Product>
  updateProduct: (id: string, input: Partial<ProductInput>) => Promise<Product>
  deleteProduct: (id: string) => Promise<void>
  fetchRecipeItems: (productId: string) => Promise<RecipeItem[]>
  addRecipeItem: (input: RecipeItemInput) => Promise<RecipeItem>
  removeRecipeItem: (id: string) => Promise<void>
}

/**
 * useProducts — manages the products list (with realtime updates), plus
 * recipe_items operations for the currently-edited product.
 *
 * Realtime: listens to INSERT and UPDATE events on the `products` collection
 * and reconciles local state; does NOT poll.
 */
export function useProducts(): UseProducts {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listProducts()
      if (!mountedRef.current) return
      setProducts(data)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Realtime subscription — INSERT and UPDATE reconciliation.
  useRealtime<RecordModel>(
    'products',
    (e: RecordSubscription<RecordModel>) => {
      if (!mountedRef.current) return
      // Only react to create/update/delete events.
      if (e.action !== 'create' && e.action !== 'update' && e.action !== 'delete') return
      if (e.action === 'delete') {
        setProducts((prev) => prev.filter((p) => p.id !== e.record.id))
        return
      }
      const record = mapProduct(e.record)
      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === record.id)
        if (idx === -1) {
          // INSERT — prepend (newest first since list sorts by -created).
          return [record, ...prev]
        }
        // UPDATE — replace in place.
        const next = prev.slice()
        next[idx] = record
        return next
      })
    },
    true,
  )

  // Re-auth guards: only subscribe while authenticated so we never receive
  // records we are not allowed to see.
  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid) void load()
    })
    return unsub
  }, [load])

  const createProduct = useCallback(async (input: ProductInput) => {
    // Realtime is the single source of truth for the products list; do not
    // mutate local state here (avoids visual duplication when the WebSocket
    // event arrives before the HTTP response).
    return createProductService(input)
  }, [])

  const updateProduct = useCallback(async (id: string, input: Partial<ProductInput>) => {
    // Realtime is the single source of truth for the products list; do not
    // mutate local state here (avoids visual duplication when the WebSocket
    // event arrives before the HTTP response).
    return updateProductService(id, input)
  }, [])

  const deleteProduct = useCallback(async (id: string) => {
    // Realtime is the single source of truth for the products list; do not
    // mutate local state here (avoids visual duplication when the WebSocket
    // event arrives before the HTTP response).
    await deleteProductService(id)
  }, [])

  const fetchRecipeItems = useCallback(async (productId: string) => {
    return listRecipeItems(productId)
  }, [])

  const addRecipeItem = useCallback(async (input: RecipeItemInput) => {
    const created = await createRecipeItemService(input)
    return created
  }, [])

  const removeRecipeItem = useCallback(async (id: string) => {
    await deleteRecipeItemService(id)
  }, [])

  return {
    products,
    loading,
    error,
    refetch: load,
    createProduct,
    updateProduct,
    deleteProduct,
    fetchRecipeItems,
    addRecipeItem,
    removeRecipeItem,
  }
}
