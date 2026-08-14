import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { listProducts } from '@/services/products'
import { listIngredients } from '@/services/ingredients'
import { listPurchases } from '@/services/purchases'
import { listAllSales } from '@/services/sales'
import type { DashboardMetrics, Ingredient, Purchase, Sale } from '@/types'

export interface UseDashboard {
  metrics: DashboardMetrics
  sales: Sale[]
  purchases: Purchase[]
  loading: boolean
  error: string | null
  refetch: () => void
}

const EMPTY_METRICS: DashboardMetrics = {
  totalRevenue: 0,
  totalExpenses: 0,
  totalProfit: 0,
  todaySales: 0,
  todaySalesCount: 0,
  monthExpenses: 0,
  monthExpensesCount: 0,
  lowStockIngredients: [],
  totalProducts: 0,
  activeProducts: 0,
  totalIfoodCommission: 0,
  ifoodSalesCount: 0,
  ifoodRevenue: 0,
}

function toPTBR(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Erro ao carregar o resumo do seu negócio.'
}

function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function computeMetrics(
  sales: Sale[],
  purchases: Purchase[],
  ingredients: Ingredient[],
  totalProducts: number,
  activeProducts: number,
): DashboardMetrics {
  const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0)
  const totalExpenses = purchases.reduce((sum, p) => sum + (p.total || 0), 0)

  // iFood commission and channel metrics.
  const totalIfoodCommission = sales.reduce(
    (sum, s) => sum + (s.ifoodCommission != null && s.ifoodCommission > 0 ? s.ifoodCommission : 0),
    0,
  )
  const ifoodSales = sales.filter((s) => s.salesChannel === 'iFood')
  const ifoodSalesCount = ifoodSales.length
  const ifoodRevenue = ifoodSales.reduce((sum, s) => sum + (s.total || 0), 0)

  const today = todayKey()
  const todaySalesRows = sales.filter((s) => {
    if (!s.date) return false
    // s.date is an ISO string; compare the YYYY-MM-DD prefix.
    return s.date.slice(0, 10) === today
  })
  const todaySales = todaySalesRows.reduce((sum, s) => sum + (s.total || 0), 0)
  const todaySalesCount = todaySalesRows.length

  const month = monthKey()
  const monthPurchases = purchases.filter((p) => {
    if (!p.date) return false
    return p.date.slice(0, 7) === month
  })
  const monthExpenses = monthPurchases.reduce((sum, p) => sum + (p.total || 0), 0)
  const monthExpensesCount = monthPurchases.length

  const lowStockIngredients = ingredients.filter(
    (i) => i.minStock > 0 && i.currentStock <= i.minStock,
  )

  return {
    totalRevenue,
    totalExpenses,
    totalProfit: totalRevenue - totalExpenses - totalIfoodCommission,
    todaySales,
    todaySalesCount,
    monthExpenses,
    monthExpensesCount,
    lowStockIngredients,
    totalProducts,
    activeProducts,
    totalIfoodCommission,
    ifoodSalesCount,
    ifoodRevenue,
  }
}

/**
 * useDashboard — aggregates sales, purchases, ingredients and products into a
 * DashboardMetrics object, refreshed in real time. Does NOT poll: a realtime
 * event on any of the four collections triggers a full parallel re-fetch.
 */
export function useDashboard(): UseDashboard {
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS)
  const [sales, setSales] = useState<Sale[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
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
      const [salesDataRaw, purchasesData, ingredientsData, productsData] = await Promise.all([
        listAllSales(),
        listPurchases(),
        listIngredients(),
        listProducts(),
      ])
      // Exclude stock-only adjustment sales from all dashboard metrics.
      const salesData = salesDataRaw.filter((s) => !s.isStockAdjustment)
      if (!mountedRef.current) return
      setSales(salesData)
      setPurchases(purchasesData)
      const totalProducts = productsData.length
      const activeProducts = productsData.filter((p) => p.active).length
      setMetrics(
        computeMetrics(salesData, purchasesData, ingredientsData, totalProducts, activeProducts),
      )
    } catch (err) {
      if (!mountedRef.current) return
      setError(toPTBR(err))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Realtime — any INSERT/UPDATE/DELETE on these collections triggers a full
  // parallel re-fetch of the aggregated data.
  const onSale = useCallback(
    (e: RecordSubscription<RecordModel>) => {
      if (!mountedRef.current) return
      if (e.action !== 'create' && e.action !== 'update' && e.action !== 'delete') return
      void load()
    },
    [load],
  )
  const onPurchase = useCallback(
    (e: RecordSubscription<RecordModel>) => {
      if (!mountedRef.current) return
      if (e.action !== 'create' && e.action !== 'update' && e.action !== 'delete') return
      void load()
    },
    [load],
  )
  const onIngredient = useCallback(
    (e: RecordSubscription<RecordModel>) => {
      if (!mountedRef.current) return
      if (e.action !== 'create' && e.action !== 'update' && e.action !== 'delete') return
      void load()
    },
    [load],
  )
  const onProduct = useCallback(
    (e: RecordSubscription<RecordModel>) => {
      if (!mountedRef.current) return
      if (e.action !== 'create' && e.action !== 'update' && e.action !== 'delete') return
      void load()
    },
    [load],
  )

  useRealtime<RecordModel>('sales', onSale, true)
  useRealtime<RecordModel>('purchases', onPurchase, true)
  useRealtime<RecordModel>('ingredients', onIngredient, true)
  useRealtime<RecordModel>('products', onProduct, true)

  // Re-load on auth changes so we never show records we can't access.
  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid) void load()
    })
    return unsub
  }, [load])

  return { metrics, sales, purchases, loading, error, refetch: load }
}

export default useDashboard
