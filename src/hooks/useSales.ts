import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { mapSale } from '@/lib/pocketbase/maps'
import type { SaleListItem } from '@/types'

export interface UseSalesParams {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
  channelFilter?: string
  paymentFilter?: string
}

export interface UseSalesResult {
  sales: SaleListItem[]
  totalCount: number
  totalPages: number
  currentPage: number
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * useSales — paginated, filtered sales history with realtime INSERT updates.
 *
 * Excludes stock-adjustment sales, sorts by date descending, and appends newly
 * created sales to the top of the current page (incrementing totalCount) via a
 * realtime subscription on the `sales` collection.
 */
export function useSales(params: UseSalesParams = {}): UseSalesResult {
  const {
    page = 1,
    pageSize = 20,
    startDate,
    endDate,
    channelFilter = 'all',
    paymentFilter = 'all',
  } = params

  const [sales, setSales] = useState<SaleListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Build the PocketBase filter string from the active filters.
  const buildFilter = useCallback(() => {
    const parts: string[] = ['isStockAdjustment != true']
    if (channelFilter && channelFilter !== 'all') {
      parts.push(`salesChannel = "${channelFilter}"`)
    }
    if (paymentFilter && paymentFilter !== 'all') {
      parts.push(`paymentMethod = "${paymentFilter}"`)
    }
    if (startDate) {
      parts.push(`date >= "${startDate} 00:00:00"`)
    }
    if (endDate) {
      parts.push(`date <= "${endDate} 23:59:59"`)
    }
    return parts.join(' && ')
  }, [channelFilter, paymentFilter, startDate, endDate])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filter = buildFilter()
      const result = await pb.collection('sales').getList(page, pageSize, {
        filter,
        sort: '-date',
      })
      if (!mountedRef.current) return
      const items = result.items.map((r) => mapSale(r) as SaleListItem)
      setSales(items)
      setTotalCount(result.totalItems)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Erro ao carregar vendas.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [buildFilter, page, pageSize])

  useEffect(() => {
    void load()
  }, [load])

  // Re-load on auth changes.
  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid) void load()
    })
    return unsub
  }, [load])

  // Realtime subscription — INSERT only: prepend new sales and bump the count.
  useRealtime<RecordModel>(
    'sales',
    (e: RecordSubscription<RecordModel>) => {
      if (!mountedRef.current) return
      if (e.action !== 'create') return
      const record = mapSale(e.record)
      if (record.isStockAdjustment) return
      setSales((prev) => {
        if (prev.some((s) => s.id === record.id)) return prev
        return [record as SaleListItem, ...prev]
      })
      setTotalCount((prev) => prev + 1)
    },
    true,
  )

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const currentPage = Math.min(page, totalPages)

  return {
    sales,
    totalCount,
    totalPages,
    currentPage,
    loading,
    error,
    refresh: load,
  }
}
