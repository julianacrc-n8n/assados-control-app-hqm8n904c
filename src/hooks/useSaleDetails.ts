import { useCallback, useEffect, useRef, useState } from 'react'

import pb from '@/lib/pocketbase/client'
import { mapSale } from '@/lib/pocketbase/maps'
import type { Sale, SaleItemDetail } from '@/types'

export interface UseSaleDetailsResult {
  sale: Sale | null
  items: SaleItemDetail[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * useSaleDetails — fetches a single sale record plus all of its sale_items,
 * enriching each item with the product name from the `products` collection.
 *
 * Re-fetches whenever `saleId` changes. Returns loading/error states for the
 * inline skeleton and error UIs in the detail sheet.
 */
export function useSaleDetails(saleId: string | null): UseSaleDetailsResult {
  const [sale, setSale] = useState<Sale | null>(null)
  const [items, setItems] = useState<SaleItemDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentIdRef = useRef<string | null>(null)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const saleRecord = await pb.collection('sales').getOne(id)
      const mappedSale = mapSale(saleRecord)

      const itemRecords = await pb.collection('sale_items').getFullList({
        filter: `saleId = "${id}"`,
        sort: 'created',
      })

      // Resolve product names in a single batched lookup.
      const productIds = Array.from(
        new Set(itemRecords.map((r) => r.productId as string).filter(Boolean)),
      )
      const productNames = new Map<string, string>()
      if (productIds.length > 0) {
        const products = await pb.collection('products').getFullList({
          filter: productIds.map((pid) => `id = "${pid}"`).join(' || '),
        })
        for (const p of products) {
          productNames.set(p.id as string, (p.name as string) ?? '')
        }
      }

      const itemDetails: SaleItemDetail[] = itemRecords.map((r) => {
        const quantity = typeof r.quantity === 'number' ? r.quantity : parseFloat(r.quantity) || 0
        const unitPrice =
          typeof r.unitPrice === 'number' ? r.unitPrice : parseFloat(r.unitPrice) || 0
        return {
          productId: r.productId as string,
          productName: productNames.get(r.productId as string) ?? 'Produto removido',
          quantity,
          unitPrice,
          subtotal: quantity * unitPrice,
        }
      })

      setSale(mappedSale)
      setItems(itemDetails)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar detalhes da venda.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    currentIdRef.current = saleId
    if (!saleId) {
      setSale(null)
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    let active = true
    void (async () => {
      if (!active) return
      await load(saleId)
    })()
    return () => {
      active = false
    }
  }, [saleId, load])

  const refetch = useCallback(() => {
    const id = currentIdRef.current
    if (id) void load(id)
  }, [load])

  return { sale, items, loading, error, refetch }
}
