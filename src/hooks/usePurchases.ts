import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import {
  createPurchase as createPurchaseService,
  deletePurchase as deletePurchaseService,
  listPurchases,
} from '@/services/purchases'
import {
  createPurchaseItem,
  deletePurchaseItem,
  listAllPurchaseItems,
  listPurchaseItems,
} from '@/services/purchase-items'
import { mapPurchase, mapPurchaseItem } from '@/lib/pocketbase/maps'
import type { Purchase, PurchaseInput, PurchaseItem, PurchaseItemInput } from '@/types'

export interface UsePurchases {
  purchases: Purchase[]
  purchaseItems: PurchaseItem[]
  loading: boolean
  error: string | null
  refetch: () => void
  createPurchase: (
    purchase: PurchaseInput,
    items: Omit<PurchaseItemInput, 'purchaseId'>[],
  ) => Promise<Purchase>
  deletePurchase: (id: string) => Promise<void>
  fetchPurchaseDetails: (purchaseId: string) => Promise<PurchaseItem[]>
}

/**
 * usePurchases — manages the purchases list with realtime updates.
 *
 * Realtime is the single source of truth for the purchases list; create and
 * delete do NOT mutate local state (avoids visual duplication when the
 * WebSocket event arrives before the HTTP response). Does NOT poll.
 *
 * createPurchase creates the purchase record then all its purchase_items
 * sequentially. deletePurchase cascade-deletes the purchase_items via the
 * backend (PocketBase relation cascadeDelete is not set, so we delete them
 * explicitly first), then the purchase itself.
 */
export function usePurchases(): UsePurchases {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
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
      const [purchaseData, itemData] = await Promise.all([listPurchases(), listAllPurchaseItems()])
      if (!mountedRef.current) return
      setPurchases(purchaseData)
      setPurchaseItems(itemData)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Erro ao carregar compras.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Realtime subscription — INSERT / UPDATE / DELETE reconciliation.
  useRealtime<RecordModel>(
    'purchases',
    (e: RecordSubscription<RecordModel>) => {
      if (!mountedRef.current) return
      if (e.action !== 'create' && e.action !== 'update' && e.action !== 'delete') return
      if (e.action === 'delete') {
        setPurchases((prev) => prev.filter((p) => p.id !== e.record.id))
        return
      }
      const record = mapPurchase(e.record)
      setPurchases((prev) => {
        const idx = prev.findIndex((p) => p.id === record.id)
        if (idx === -1) {
          // INSERT — prepend (newest first since list sorts by -date).
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

  // Realtime for purchase_items — reconcile the items list (used for the
  // per-purchase item count shown in the Compras table).
  useRealtime<RecordModel>(
    'purchase_items',
    (e: RecordSubscription<RecordModel>) => {
      if (!mountedRef.current) return
      if (e.action !== 'create' && e.action !== 'update' && e.action !== 'delete') return
      if (e.action === 'delete') {
        setPurchaseItems((prev) => prev.filter((i) => i.id !== e.record.id))
        return
      }
      const record = mapPurchaseItem(e.record)
      setPurchaseItems((prev) => {
        const idx = prev.findIndex((i) => i.id === record.id)
        if (idx === -1) {
          return [record, ...prev]
        }
        const next = prev.slice()
        next[idx] = record
        return next
      })
    },
    true,
  )

  // Re-load on auth changes.
  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid) void load()
    })
    return unsub
  }, [load])

  const createPurchase = useCallback(
    async (
      purchase: PurchaseInput,
      items: Omit<PurchaseItemInput, 'purchaseId'>[],
    ): Promise<Purchase> => {
      // Create the purchase record first.
      const created = await createPurchaseService(purchase)
      // Then create each purchase_item sequentially.
      for (const item of items) {
        await createPurchaseItem({
          purchaseId: created.id,
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })
      }
      return created
    },
    [],
  )

  const deletePurchase = useCallback(async (id: string) => {
    // Cascade-delete purchase_items first (relation has no cascadeDelete).
    try {
      const items = await listPurchaseItems(id)
      for (const item of items) {
        await deletePurchaseItem(item.id)
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao excluir itens da compra.')
    }
    // Then delete the purchase itself.
    await deletePurchaseService(id)
  }, [])

  const fetchPurchaseDetails = useCallback(async (purchaseId: string) => {
    return listPurchaseItems(purchaseId)
  }, [])

  return {
    purchases,
    purchaseItems,
    loading,
    error,
    refetch: load,
    createPurchase,
    deletePurchase,
    fetchPurchaseDetails,
  }
}
