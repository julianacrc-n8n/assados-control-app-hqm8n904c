import { useCallback, useRef, useState } from 'react'

import { listAllSales } from '@/services/sales'
import { listPurchases } from '@/services/purchases'
import { listAllSaleItems } from '@/services/sale-items'
import { listProducts } from '@/services/products'
import type { Product, Purchase, Sale, SaleItem, ReportData, DailyPoint } from '@/types'

export interface UseReports {
  reportData: ReportData | null
  loading: boolean
  error: string | null
  refresh: (startDate: string | Date, endDate: string | Date) => Promise<void>
}

export type ReportPeriod = {
  startDate: string
  endDate: string
}

const EMPTY_REPORT: ReportData = {
  totalRevenue: 0,
  totalExpenses: 0,
  totalProfit: 0,
  salesCount: 0,
  purchasesCount: 0,
  averageTicket: 0,
  dailyRevenue: [],
  dailyExpenses: [],
  topProducts: [],
  paymentBreakdown: { dinheiro: 0, cartao: 0, pix: 0 },
}

function toPTBR(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Não foi possível carregar os dados do período selecionado.'
}

/** Normalize a Date or 'YYYY-MM-DD' string into a 'YYYY-MM-DD' string. */
function toYMD(input: string | Date): string {
  if (input instanceof Date) {
    const y = input.getFullYear()
    const m = String(input.getMonth() + 1).padStart(2, '0')
    const d = String(input.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // Accept 'YYYY-MM-DD' (and ignore any time portion after a 'T' or space).
  const trimmed = String(input).trim()
  return trimmed.slice(0, 10)
}

/** Extract the 'YYYY-MM-DD' portion of a record's date field. */
function recordDay(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.slice(0, 10)
}

/** Format a 'YYYY-MM-DD' as 'DD/MM'. */
function dayLabel(ymd: string): string {
  const parts = ymd.split('-')
  if (parts.length !== 3) return ymd
  return `${parts[2]}/${parts[1]}`
}

/**
 * ISO week number (Monday-based). Returns the year + week number so we can
 * group consecutive days that span a year boundary correctly.
 */
function isoWeek(ymd: string): { year: number; week: number } {
  const d = new Date(`${ymd}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return { year: 0, week: 0 }
  const dayMs = 86400000
  // Thursday of this ISO week.
  const thursday = new Date(d)
  thursday.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const year = thursday.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(year, 0, 4))
  const week =
    1 +
    Math.round(
      (thursday.getTime() - firstThursday.getTime()) / 7 / dayMs -
        ((firstThursday.getUTCDay() + 6) % 7) / 7,
    )
  return { year, week }
}

/** Build the list of days in the period (inclusive) as 'YYYY-MM-DD'. */
function daysBetween(start: string, end: string): string[] {
  const days: string[] = []
  const startMs = new Date(`${start}T00:00:00`).getTime()
  const endMs = new Date(`${end}T00:00:00`).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return days
  const dayMs = 86400000
  for (let t = startMs; t <= endMs; t += dayMs) {
    const d = new Date(t)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    days.push(`${y}-${m}-${dd}`)
  }
  return days
}

/**
 * Aggregate per-day (or per-week when the period exceeds 31 days) totals into
 * a DailyPoint array — one entry per day/week, in chronological order.
 */
function buildSeries(
  records: { date: string; total: number }[],
  start: string,
  end: string,
): DailyPoint[] {
  const days = daysBetween(start, end)
  if (days.length === 0) return []

  const useWeekly = days.length > 31

  if (!useWeekly) {
    const totals = new Map<string, number>()
    for (const ymd of days) totals.set(ymd, 0)
    for (const r of records) {
      const ymd = recordDay(r.date)
      if (!ymd || !totals.has(ymd)) continue
      totals.set(ymd, (totals.get(ymd) ?? 0) + (r.total || 0))
    }
    return days.map((ymd) => ({ date: dayLabel(ymd), value: totals.get(ymd) ?? 0 }))
  }

  // Weekly aggregation — one bucket per ISO week touched by the period.
  const weekOrder: string[] = []
  const weekTotals = new Map<string, number>()
  const weekLabels = new Map<string, string>()
  let weekSeq = 0
  for (const ymd of days) {
    const { year, week } = isoWeek(ymd)
    const key = `${year}-${week}`
    if (!weekTotals.has(key)) {
      weekSeq += 1
      weekOrder.push(key)
      weekTotals.set(key, 0)
      weekLabels.set(key, `Sem. ${weekSeq}`)
    }
  }
  for (const r of records) {
    const ymd = recordDay(r.date)
    if (!ymd) continue
    const { year, week } = isoWeek(ymd)
    const key = `${year}-${week}`
    if (!weekTotals.has(key)) continue
    weekTotals.set(key, (weekTotals.get(key) ?? 0) + (r.total || 0))
  }
  return weekOrder.map((key) => ({
    date: weekLabels.get(key) ?? key,
    value: weekTotals.get(key) ?? 0,
  }))
}

/** Compute the full ReportData snapshot from the fetched records. */
function computeReport(
  sales: Sale[],
  purchases: Purchase[],
  saleItems: SaleItem[],
  products: Product[],
  start: string,
  end: string,
): ReportData {
  const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0)
  const totalExpenses = purchases.reduce((sum, p) => sum + (p.total || 0), 0)
  const salesCount = sales.length
  const purchasesCount = purchases.length
  const averageTicket = salesCount > 0 ? totalRevenue / salesCount : 0

  const dailyRevenue = buildSeries(sales, start, end)
  const dailyExpenses = buildSeries(purchases, start, end)

  // Top products — group sale_items by productId, sum quantity and revenue.
  const productMap = new Map<string, Product>()
  for (const p of products) productMap.set(p.id, p)

  const grouped = new Map<string, { quantity: number; revenue: number }>()
  for (const item of saleItems) {
    const key = item.productId
    if (!key) continue
    const cur = grouped.get(key) ?? { quantity: 0, revenue: 0 }
    cur.quantity += item.quantity || 0
    cur.revenue += (item.quantity || 0) * (item.unitPrice || 0)
    grouped.set(key, cur)
  }

  const topProducts = Array.from(grouped.entries())
    .map(([productId, agg]) => {
      const product = productMap.get(productId)
      return {
        productName: product?.name ?? 'Produto removido',
        quantitySold: agg.quantity,
        totalRevenue: agg.revenue,
      }
    })
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 10)

  const paymentBreakdown = { dinheiro: 0, cartao: 0, pix: 0 }
  for (const s of sales) {
    const method = (s.paymentMethod || '').toLowerCase()
    if (method === 'cartao' || method === 'card') {
      paymentBreakdown.cartao += s.total || 0
    } else if (method === 'pix') {
      paymentBreakdown.pix += s.total || 0
    } else {
      paymentBreakdown.dinheiro += s.total || 0
    }
  }

  return {
    totalRevenue,
    totalExpenses,
    totalProfit: totalRevenue - totalExpenses,
    salesCount,
    purchasesCount,
    averageTicket,
    dailyRevenue,
    dailyExpenses,
    topProducts,
    paymentBreakdown,
  }
}

/**
 * useReports — point-in-time financial reports for a date range.
 *
 * Fetches sales, purchases, sale_items and products in parallel, then
 * aggregates them into a ReportData snapshot. Reports are NOT realtime: the
 * consumer triggers a refresh (and an initial load) explicitly.
 */
export function useReports(): UseReports {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const refresh = useCallback(async (startDate: string | Date, endDate: string | Date) => {
    const start = toYMD(startDate)
    const end = toYMD(endDate)
    setLoading(true)
    setError(null)
    try {
      const [allSales, allPurchases, allSaleItems, products] = await Promise.all([
        listAllSales(),
        listPurchases(),
        listAllSaleItems(),
        listProducts(),
      ])

      // Keep only records whose date falls within the period (inclusive).
      const periodSales = allSales.filter((s) => {
        const d = recordDay(s.date)
        return d >= start && d <= end
      })
      const periodPurchases = allPurchases.filter((p) => {
        const d = recordDay(p.date)
        return d >= start && d <= end
      })

      // sale_items relevant to the period's sales.
      const saleIdSet = new Set(periodSales.map((s) => s.id))
      const periodSaleItems = allSaleItems.filter((si) => saleIdSet.has(si.saleId))

      if (!mountedRef.current) return
      setReportData(
        computeReport(periodSales, periodPurchases, periodSaleItems, products, start, end),
      )
    } catch (err) {
      if (!mountedRef.current) return
      setError(toPTBR(err))
      setReportData(null)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  return { reportData, loading, error, refresh }
}

export default useReports
