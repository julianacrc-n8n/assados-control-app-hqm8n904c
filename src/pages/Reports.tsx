import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  Download,
  FileText,
  Filter,
  GitCompare,
  Loader2,
  Minus,
  Receipt,
  RefreshCw,
  Store,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useReports } from '@/hooks/useReports'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { listAllSaleItems } from '@/services/sale-items'
import { listProducts } from '@/services/products'
import { listPurchases } from '@/services/purchases'
import { listAllSales } from '@/services/sales'
import { formatBRL, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  DailyPoint,
  PaymentBreakdown,
  Product,
  Purchase,
  ReportData,
  Sale,
  SaleItem,
  TopProduct,
} from '@/types'

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayYMD(): string {
  return toYMD(new Date())
}

function firstDayOfMonthYMD(): string {
  const d = new Date()
  return toYMD(new Date(d.getFullYear(), d.getMonth(), 1))
}

function daysAgoYMD(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toYMD(d)
}

/** Format 'YYYY-MM-DD' as 'DD/MM/YYYY'. */
function formatBR(ymd: string): string {
  const parts = ymd.split('-')
  if (parts.length !== 3) return ymd
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

/** Format a number as a percentage string with 1 decimal place, e.g. 42.3%. */
function formatPercent(value: number, total: number): string {
  if (total <= 0) return '0,0%'
  const pct = (value / total) * 100
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

/* ------------------------------------------------------------------ */
/* Quick filter presets                                                */
/* ------------------------------------------------------------------ */

type Preset = 'hoje' | '7dias' | 'mes' | '30dias'

function presetRange(preset: Preset): { start: string; end: string } {
  const today = todayYMD()
  switch (preset) {
    case 'hoje':
      return { start: today, end: today }
    case '7dias':
      return { start: daysAgoYMD(7), end: today }
    case 'mes':
      return { start: firstDayOfMonthYMD(), end: today }
    case '30dias':
      return { start: daysAgoYMD(30), end: today }
  }
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

function exportProductsCsv(products: TopProduct[]): void {
  const header = ['Produto', 'Quantidade', 'Receita']
  const rows = products.map((p) => [
    escapeCsv(p.productName),
    String(p.quantitySold),
    String(p.totalRevenue.toFixed(2).replace('.', ',')),
  ])
  const csv = [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const today = todayYMD().split('-').reverse().join('-')
  const filename = `relatorio-produtos-${today}.csv`
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapeCsv(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/* ------------------------------------------------------------------ */
/* PDF export — print-optimized popup report                           */
/* ------------------------------------------------------------------ */

/** Format a number as Brazilian Real with the exact pt-BR representation. */
function brl(value: number): string {
  return formatBRL(value)
}

/** Format a 'YYYY-MM-DD' as 'DD/MM/YYYY' for the report header. */
function brDate(ymd: string): string {
  return formatBR(ymd)
}

/** Escape a string for safe insertion into raw HTML. */
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Format the current date/time as "DD/MM/AAAA às HH:mm". */
function generatedAt(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} às ${hh}:${min}`
}

/** Build the text-based bar chart HTML for the revenue vs expenses series. */
function buildBarChartHtml(
  dailyRevenue: DailyPoint[],
  dailyExpenses: DailyPoint[],
  dailyIfoodCommission: DailyPoint[],
): string {
  const hasData =
    dailyRevenue.some((p) => p.value > 0) ||
    dailyExpenses.some((p) => p.value > 0) ||
    dailyIfoodCommission.some((p) => p.value > 0)

  if (!hasData) {
    return '<div style="text-align:center;padding:12px;color:#777777;font-size:11px;">Sem dados de receitas e despesas no período.</div>'
  }

  const max = Math.max(
    0,
    ...dailyRevenue.map((p) => p.value),
    ...dailyExpenses.map((p) => p.value),
    ...dailyIfoodCommission.map((p) => p.value),
  )
  const maxSafe = max > 0 ? max : 1

  let points = dailyRevenue.map((rev, i) => ({
    label: rev.date,
    revenue: rev.value,
    expenses: dailyExpenses[i]?.value ?? 0,
    commission: dailyIfoodCommission[i]?.value ?? 0,
  }))

  // If more than 15 data points, sample every Nth so the chart fits one page.
  if (points.length > 15) {
    const n = Math.ceil(points.length / 15)
    points = points.filter((_, idx) => idx % n === 0)
  }

  const rows = points
    .map((p) => {
      const revW = Math.max((p.revenue / maxSafe) * 300, p.revenue > 0 ? 1 : 0)
      const expW = Math.max((p.expenses / maxSafe) * 300, p.expenses > 0 ? 1 : 0)
      const comW = Math.max((p.commission / maxSafe) * 300, p.commission > 0 ? 1 : 0)
      return `
      <div style="display:flex;align-items:center;margin-bottom:6px;">
        <div style="width:50px;font-size:9px;color:#555555;flex-shrink:0;">${escapeHtml(p.label)}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;margin-bottom:2px;">
            <div style="height:9px;background-color:#006600;width:${revW}px;border-radius:2px;"></div>
            ${p.revenue > 0 ? `<span style="font-size:9px;color:#333333;margin-left:4px;">${brl(p.revenue)}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;margin-bottom:2px;">
            <div style="height:9px;background-color:#990000;width:${expW}px;border-radius:2px;"></div>
            ${p.expenses > 0 ? `<span style="font-size:9px;color:#333333;margin-left:4px;">${brl(p.expenses)}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;">
            <div style="height:9px;background-color:#cc7a00;width:${comW}px;border-radius:2px;"></div>
            ${p.commission > 0 ? `<span style="font-size:9px;color:#333333;margin-left:4px;">${brl(p.commission)}</span>` : ''}
          </div>
        </div>
      </div>`
    })
    .join('')

  return `
    <div style="page-break-inside:avoid;">
      ${rows}
      <div style="display:flex;gap:16px;margin-top:8px;font-size:10px;color:#555555;">
        <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background-color:#006600;"></span>Receitas</span>
        <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background-color:#990000;"></span>Despesas</span>
        <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background-color:#cc7a00;"></span>Comissão iFood</span>
      </div>
    </div>`
}

/** Build the full self-contained HTML document for the printable report. */
function buildReportHtml(data: ReportData, start: string, end: string, storeName: string): string {
  const profit = data.totalProfit
  const profitColor = profit > 0 ? '#006600' : profit < 0 ? '#990000' : '#333333'

  const payTotal =
    data.paymentBreakdown.dinheiro + data.paymentBreakdown.cartao + data.paymentBreakdown.pix
  const payEmpty = payTotal <= 0
  const paymentRow = payEmpty
    ? `<tr><td colspan="3" style="padding:12px;text-align:center;color:#777777;font-size:11px;">Sem vendas no período.</td></tr>`
    : `<tr>
        <td style="padding:8px 10px;text-align:center;font-size:12px;">
          ${brl(data.paymentBreakdown.dinheiro)}<br/>
          <span style="font-size:10px;color:#777777;">(${formatPercent(data.paymentBreakdown.dinheiro, payTotal)})</span>
        </td>
        <td style="padding:8px 10px;text-align:center;font-size:12px;">
          ${brl(data.paymentBreakdown.cartao)}<br/>
          <span style="font-size:10px;color:#777777;">(${formatPercent(data.paymentBreakdown.cartao, payTotal)})</span>
        </td>
        <td style="padding:8px 10px;text-align:center;font-size:12px;">
          ${brl(data.paymentBreakdown.pix)}<br/>
          <span style="font-size:10px;color:#777777;">(${formatPercent(data.paymentBreakdown.pix, payTotal)})</span>
        </td>
      </tr>`

  const chartHtml = buildBarChartHtml(
    data.dailyRevenue,
    data.dailyExpenses,
    data.dailyIfoodCommission,
  )

  const productsHtml =
    data.topProducts.length === 0
      ? `<tr><td colspan="4" style="padding:12px;text-align:center;color:#777777;font-size:11px;">Nenhum produto vendido no período.</td></tr>`
      : data.topProducts
          .map(
            (p, idx) => `
        <tr style="background-color:${idx % 2 === 1 ? '#F9F9F9' : '#FFFFFF'};">
          <td style="padding:6px 10px;text-align:center;font-weight:700;color:#333333;font-size:11px;width:30px;">${idx + 1}</td>
          <td style="padding:6px 10px;text-align:left;font-size:11px;">${escapeHtml(p.productName)}</td>
          <td style="padding:6px 10px;text-align:center;font-variant-numeric:tabular-nums;font-size:11px;">${formatNumber(p.quantitySold)}</td>
          <td style="padding:6px 10px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;font-size:11px;">${brl(p.totalRevenue)}</td>
        </tr>`,
          )
          .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório Financeiro — ${escapeHtml(storeName)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #000000;
    background: #ffffff;
    line-height: 1.5;
    padding: 0;
    margin: 0;
  }
  h2 { margin: 0; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #CCCCCC; }
  .section-title { font-size: 14px; font-weight: 700; margin-top: 16px; margin-bottom: 8px; }
  .avoid-break { page-break-inside: avoid; }
  th { background: #333333; color: #ffffff; font-weight: 600; font-size: 11px; padding: 6px 10px; text-align: center; }
  .header { border-bottom: 2px solid #333333; padding-bottom: 12px; margin-bottom: 4px; }
  .footer { border-top: 2px solid #333333; margin-top: 20px; padding-top: 8px; }
  .footer-row { display: flex; justify-content: space-between; }
  .footer-center { text-align: center; margin-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div style="font-size:20px;font-weight:700;text-align:center;margin-bottom:4px;">${escapeHtml(storeName)}</div>
    <div style="font-size:14px;font-weight:600;text-align:center;color:#555555;margin-bottom:8px;">Relatório Financeiro</div>
    <div style="font-size:11px;text-align:center;color:#777777;margin-bottom:16px;">Período: ${brDate(start)} a ${brDate(end)}</div>
    <div style="font-size:10px;text-align:right;color:#999999;margin-bottom:16px;">Gerado em: ${generatedAt()}</div>
  </div>

  <div class="avoid-break">
    <div class="section-title">Resumo Financeiro</div>
    <table>
      <thead>
        <tr>
          <th>Receita Total</th>
          <th>Despesa Total</th>
          <th>Comissão iFood</th>
          <th>Lucro</th>
          <th>Ticket Médio</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px 6px;text-align:center;font-size:9px;font-weight:700;color:#006600;">${brl(data.totalRevenue)}</td>
          <td style="padding:8px 6px;text-align:center;font-size:9px;font-weight:700;color:#990000;">${brl(data.totalExpenses)}</td>
          <td style="padding:8px 6px;text-align:center;font-size:9px;font-weight:700;color:#cc7a00;">${brl(data.totalIfoodCommission)}</td>
          <td style="padding:8px 6px;text-align:center;font-size:9px;font-weight:700;color:${profitColor};">${brl(data.totalProfit)}</td>
          <td style="padding:8px 6px;text-align:center;font-size:9px;font-weight:700;color:#333333;">${brl(data.averageTicket)}</td>
        </tr>
      </tbody>
    </table>
    <div style="font-size:10px;color:#777777;margin-top:4px;">Total de vendas: ${data.salesCount} | Total de compras: ${data.purchasesCount} | Vendas no iFood: ${data.ifoodSalesCount}</div>
  </div>

  <div class="avoid-break">
    <div class="section-title">Formas de Pagamento</div>
    <table>
      <thead>
        <tr>
          <th>Dinheiro</th>
          <th>Cartão</th>
          <th>Pix</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRow}
      </tbody>
    </table>
  </div>

  <div>
    <div class="section-title">Receitas vs Despesas por Dia</div>
    ${chartHtml}
  </div>

  <div class="avoid-break">
    <div class="section-title">Produtos Mais Vendidos</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:30px;">#</th>
          <th style="text-align:left;">Produto</th>
          <th style="text-align:center;">Quantidade Vendida</th>
          <th style="text-align:right;">Receita Gerada</th>
        </tr>
      </thead>
      <tbody>
        ${productsHtml}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div class="footer-row">
      <span style="font-size:9px;color:#999999;">${escapeHtml(storeName)} - Sistema de Gestão</span>
      <span style="font-size:9px;color:#999999;text-align:right;">Página 1 de 1</span>
    </div>
    <div class="footer-center" style="font-size:9px;color:#BBBBBB;">Documento gerado automaticamente pelo sistema.</div>
  </div>

  <script>
    setTimeout(function () { window.print(); }, 250);
  </script>
</body>
</html>`
}

function exportReportPdf(data: ReportData, start: string, end: string, storeName: string): boolean {
  const html = buildReportHtml(data, start, end, storeName)
  const printWin = window.open('', '_blank', 'width=900,height=1200')
  if (!printWin) return false
  printWin.document.open()
  printWin.document.write(html)
  printWin.document.close()
  return true
}

/* ------------------------------------------------------------------ */
/* Period comparison — data + helpers                                  */
/* ------------------------------------------------------------------ */

export interface ComparisonProductRow {
  productName: string
  quantityA: number
  revenueA: number
  quantityB: number
  revenueB: number
}

export interface ComparisonData {
  startA: string
  endA: string
  startB: string
  endB: string
  receitaA: number
  receitaB: number
  despesaA: number
  despesaB: number
  comissaoA: number
  comissaoB: number
  lucroA: number
  lucroB: number
  ticketA: number
  ticketB: number
  products: ComparisonProductRow[]
}

interface PeriodTotals {
  receita: number
  despesa: number
  comissao: number
  lucro: number
  ticket: number
  productMap: Map<string, { quantity: number; revenue: number }>
  productNameMap: Map<string, string>
  hasData: boolean
}

/** A self-contained synchronous period aggregator that reuses the same logic
 * as useReports but operates on the already-fetched full record sets. This
 * keeps comparison mode fully client-side without duplicating network calls. */
function computePeriodTotals(
  sales: Sale[],
  purchases: Purchase[],
  saleItems: SaleItem[],
  products: Product[],
  start: string,
  end: string,
): PeriodTotals {
  const periodSales = sales.filter((s) => {
    if (s.isStockAdjustment) return false
    const d = String(s.date).slice(0, 10)
    return d >= start && d <= end
  })
  const periodPurchases = purchases.filter((p) => {
    const d = String(p.date).slice(0, 10)
    return d >= start && d <= end
  })
  const saleIdSet = new Set(periodSales.map((s) => s.id))
  const periodSaleItems = saleItems.filter((si) => saleIdSet.has(si.saleId))

  const receita = periodSales.reduce((sum, s) => sum + (s.total || 0), 0)
  const despesa = periodPurchases.reduce((sum, p) => sum + (p.total || 0), 0)
  const comissao = periodSales.reduce(
    (sum, s) => sum + (s.ifoodCommission != null && s.ifoodCommission > 0 ? s.ifoodCommission : 0),
    0,
  )
  const ticket = periodSales.length > 0 ? receita / periodSales.length : 0

  const productMap = new Map<string, { quantity: number; revenue: number }>()
  for (const item of periodSaleItems) {
    if (!item.productId) continue
    const cur = productMap.get(item.productId) ?? { quantity: 0, revenue: 0 }
    cur.quantity += item.quantity || 0
    cur.revenue += (item.quantity || 0) * (item.unitPrice || 0)
    productMap.set(item.productId, cur)
  }
  const productNameMap = new Map<string, string>()
  for (const p of products) productNameMap.set(p.id, p.name)

  return {
    receita,
    despesa,
    comissao,
    lucro: receita - despesa - comissao,
    ticket,
    productMap,
    productNameMap,
    hasData: periodSales.length > 0 || periodPurchases.length > 0,
  }
}

/** Build the full ComparisonData for two periods. */
function buildComparisonData(
  sales: Sale[],
  purchases: Purchase[],
  saleItems: SaleItem[],
  products: Product[],
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): ComparisonData {
  const a = computePeriodTotals(sales, purchases, saleItems, products, startA, endA)
  const b = computePeriodTotals(sales, purchases, saleItems, products, startB, endB)

  // Union of top-10 product ids from EITHER period, ranked by quantity of A
  // then B as a stable tiebreaker.
  const topA = Array.from(a.productMap.entries())
    .sort(([, x], [, y]) => y.quantity - x.quantity)
    .slice(0, 10)
    .map(([id]) => id)
  const topB = Array.from(b.productMap.entries())
    .sort(([, x], [, y]) => y.quantity - x.quantity)
    .slice(0, 10)
    .map(([id]) => id)
  const unionIds = Array.from(new Set([...topA, ...topB]))

  const products2: ComparisonProductRow[] = unionIds
    .map((id) => {
      const pa = a.productMap.get(id) ?? { quantity: 0, revenue: 0 }
      const pb = b.productMap.get(id) ?? { quantity: 0, revenue: 0 }
      const name = a.productNameMap.get(id) ?? b.productNameMap.get(id) ?? 'Produto removido'
      return {
        productName: name,
        quantityA: pa.quantity,
        revenueA: pa.revenue,
        quantityB: pb.quantity,
        revenueB: pb.revenue,
      }
    })
    .sort((x, y) => y.quantityA + y.quantityB - (x.quantityA + x.quantityB))

  return {
    startA,
    endA,
    startB,
    endB,
    receitaA: a.receita,
    receitaB: b.receita,
    despesaA: a.despesa,
    despesaB: b.despesa,
    comissaoA: a.comissao,
    comissaoB: b.comissao,
    lucroA: a.lucro,
    lucroB: b.lucro,
    ticketA: a.ticket,
    ticketB: b.ticket,
    products: products2,
  }
}

/** Variation descriptor for a single metric between period A and B. */
interface Variation {
  diff: number
  pct: number | null
  direction: 'up' | 'down' | 'equal' | 'noB'
}

function computeVariation(a: number, b: number): Variation {
  if (b === 0) {
    return { diff: a - b, pct: null, direction: a === 0 ? 'equal' : 'noB' }
  }
  const diff = a - b
  const pct = (diff / Math.abs(b)) * 100
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'equal'
  return { diff, pct, direction }
}

/** Format a signed currency delta, e.g. "+R$ 120,00" / "-R$ 30,50". */
function formatSignedBRL(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatBRL(Math.abs(value))}`
}

/** Format a signed percentage, e.g. "+12,3%" / "-5,0%". */
function formatSignedPct(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct > 0 ? '+' : pct < 0 ? '-' : ''
  return `${sign}${Math.abs(pct).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

/* ------------------------------------------------------------------ */
/* Comparison PDF export                                                */
/* ------------------------------------------------------------------ */

function buildComparisonChartTextBars(data: ComparisonData): string {
  const values = [
    { label: 'Receitas', a: data.receitaA, b: data.receitaB, color: '#006600' },
    { label: 'Despesas', a: data.despesaA, b: data.despesaB, color: '#990000' },
    { label: 'Comissão iFood', a: data.comissaoA, b: data.comissaoB, color: '#cc7a00' },
  ]
  const max = Math.max(1, ...values.map((v) => v.a), ...values.map((v) => v.b))

  const rows = values
    .map((v) => {
      const wA = Math.max((v.a / max) * 260, v.a > 0 ? 1 : 0)
      const wB = Math.max((v.b / max) * 260, v.b > 0 ? 1 : 0)
      return `
      <div style="margin-bottom:10px;">
        <div style="font-size:10px;font-weight:600;color:#333333;margin-bottom:3px;">${escapeHtml(v.label)}</div>
        <div style="display:flex;align-items:center;margin-bottom:2px;">
          <span style="width:60px;font-size:9px;color:#555555;flex-shrink:0;">Período A</span>
          <div style="height:10px;background-color:${v.color};width:${wA}px;border-radius:2px;"></div>
          ${v.a > 0 ? `<span style="font-size:9px;color:#333333;margin-left:4px;">${brl(v.a)}</span>` : '<span style="font-size:9px;color:#999999;margin-left:4px;">—</span>'}
        </div>
        <div style="display:flex;align-items:center;">
          <span style="width:60px;font-size:9px;color:#555555;flex-shrink:0;">Período B</span>
          <div style="height:10px;background-color:${v.color};width:${wB}px;border-radius:2px;opacity:0.7;"></div>
          ${v.b > 0 ? `<span style="font-size:9px;color:#333333;margin-left:4px;">${brl(v.b)}</span>` : '<span style="font-size:9px;color:#999999;margin-left:4px;">—</span>'}
        </div>
      </div>`
    })
    .join('')

  return `
    <div style="page-break-inside:avoid;">
      ${rows}
      <div style="display:flex;gap:16px;margin-top:8px;font-size:10px;color:#555555;">
        <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background-color:#006600;"></span>Receitas</span>
        <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background-color:#990000;"></span>Despesas</span>
        <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background-color:#cc7a00;"></span>Comissão iFood</span>
      </div>
    </div>`
}

function buildComparisonHtml(data: ComparisonData, storeName: string): string {
  const metrics: { label: string; a: number; b: number }[] = [
    { label: 'Receita Total', a: data.receitaA, b: data.receitaB },
    { label: 'Despesa Total', a: data.despesaA, b: data.despesaB },
    { label: 'Comissão iFood', a: data.comissaoA, b: data.comissaoB },
    { label: 'Lucro Líquido', a: data.lucroA, b: data.lucroB },
    { label: 'Ticket Médio', a: data.ticketA, b: data.ticketB },
  ]
  const cardsRow = metrics
    .map((m) => {
      const v = computeVariation(m.a, m.b)
      const varColor =
        v.direction === 'up' ? '#006600' : v.direction === 'down' ? '#990000' : '#333333'
      const varText =
        v.direction === 'noB'
          ? 'Sem dados no período B'
          : `${formatSignedBRL(v.diff)} (${formatSignedPct(v.pct)})`
      return `
        <tr>
          <td style="padding:8px 6px;text-align:left;font-size:11px;font-weight:600;">${escapeHtml(m.label)}</td>
          <td style="padding:8px 6px;text-align:center;font-size:11px;font-weight:700;">${brl(m.a)}</td>
          <td style="padding:8px 6px;text-align:center;font-size:11px;font-weight:700;">${brl(m.b)}</td>
          <td style="padding:8px 6px;text-align:center;font-size:11px;font-weight:700;color:${varColor};">${escapeHtml(varText)}</td>
        </tr>`
    })
    .join('')

  const chartHtml = buildComparisonChartTextBars(data)

  const productsHtml =
    data.products.length === 0
      ? `<tr><td colspan="7" style="padding:12px;text-align:center;color:#777777;font-size:11px;">Nenhum produto vendido nos períodos.</td></tr>`
      : data.products
          .map((p, idx) => {
            const vQ = computeVariation(p.quantityA, p.quantityB)
            const qColor =
              vQ.direction === 'up' ? '#006600' : vQ.direction === 'down' ? '#990000' : '#333333'
            const qText =
              vQ.direction === 'noB'
                ? '—'
                : `${vQ.diff > 0 ? '+' : vQ.diff < 0 ? '-' : ''}${Math.abs(vQ.diff)} (${formatSignedPct(vQ.pct)})`
            return `
        <tr style="background-color:${idx % 2 === 1 ? '#F9F9F9' : '#FFFFFF'};">
          <td style="padding:6px 10px;text-align:center;font-weight:700;color:#333333;font-size:11px;width:30px;">${idx + 1}</td>
          <td style="padding:6px 10px;text-align:left;font-size:11px;">${escapeHtml(p.productName)}</td>
          <td style="padding:6px 10px;text-align:center;font-variant-numeric:tabular-nums;font-size:11px;">${formatNumber(p.quantityA)}</td>
          <td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;font-size:11px;">${brl(p.revenueA)}</td>
          <td style="padding:6px 10px;text-align:center;font-variant-numeric:tabular-nums;font-size:11px;">${formatNumber(p.quantityB)}</td>
          <td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;font-size:11px;">${brl(p.revenueB)}</td>
          <td style="padding:6px 10px;text-align:center;font-size:10px;color:${qColor};">${escapeHtml(qText)}</td>
        </tr>`
          })
          .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório Comparativo — ${escapeHtml(storeName)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #000000;
    background: #ffffff;
    line-height: 1.5;
    padding: 0;
    margin: 0;
  }
  h2 { margin: 0; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #CCCCCC; }
  .section-title { font-size: 14px; font-weight: 700; margin-top: 16px; margin-bottom: 8px; }
  .avoid-break { page-break-inside: avoid; }
  th { background: #333333; color: #ffffff; font-weight: 600; font-size: 11px; padding: 6px 10px; text-align: center; }
  .header { border-bottom: 2px solid #333333; padding-bottom: 12px; margin-bottom: 4px; }
  .footer { border-top: 2px solid #333333; margin-top: 20px; padding-top: 8px; }
  .footer-row { display: flex; justify-content: space-between; }
  .footer-center { text-align: center; margin-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div style="font-size:20px;font-weight:700;text-align:center;margin-bottom:4px;">${escapeHtml(storeName)}</div>
    <div style="font-size:14px;font-weight:600;text-align:center;color:#555555;margin-bottom:8px;">Relatório Comparativo</div>
    <div style="font-size:11px;text-align:center;color:#555555;margin-bottom:4px;">Período A: ${brDate(data.startA)} a ${brDate(data.endA)}</div>
    <div style="font-size:11px;text-align:center;color:#555555;margin-bottom:16px;">Período B: ${brDate(data.startB)} a ${brDate(data.endB)}</div>
    <div style="font-size:10px;text-align:right;color:#999999;margin-bottom:16px;">Gerado em: ${generatedAt()}</div>
  </div>

  <div class="avoid-break">
    <div class="section-title">Comparativo de Indicadores</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Indicador</th>
          <th>Período A</th>
          <th>Período B</th>
          <th>Variação</th>
        </tr>
      </thead>
      <tbody>
        ${cardsRow}
      </tbody>
    </table>
  </div>

  <div class="avoid-break">
    <div class="section-title">Comparativo de Receitas, Despesas e Comissão</div>
    ${chartHtml}
  </div>

  <div class="avoid-break">
    <div class="section-title">Produtos Mais Vendidos — Comparativo</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:30px;">#</th>
          <th style="text-align:left;">Produto</th>
          <th>Qtd A</th>
          <th>Receita A</th>
          <th>Qtd B</th>
          <th>Receita B</th>
          <th>Variação Qtd</th>
        </tr>
      </thead>
      <tbody>
        ${productsHtml}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div class="footer-row">
      <span style="font-size:9px;color:#999999;">${escapeHtml(storeName)} - Sistema de Gestão</span>
      <span style="font-size:9px;color:#999999;text-align:right;">Página 1 de 1</span>
    </div>
    <div class="footer-center" style="font-size:9px;color:#BBBBBB;">Documento gerado automaticamente pelo sistema.</div>
  </div>

  <script>
    setTimeout(function () { window.print(); }, 250);
  </script>
</body>
</html>`
}

function exportComparisonPdf(data: ComparisonData, storeName: string): boolean {
  const html = buildComparisonHtml(data, storeName)
  const printWin = window.open('', '_blank', 'width=900,height=1200')
  if (!printWin) return false
  printWin.document.open()
  printWin.document.write(html)
  printWin.document.close()
  return true
}

/* ------------------------------------------------------------------ */
/* Summary card                                                        */
/* ------------------------------------------------------------------ */

interface SummaryCardProps {
  icon: React.ElementType
  label: string
  value: string
  valueClassName?: string
  iconContainerClass: string
  iconClass: string
  subtitle: React.ReactNode
  ariaLabel?: string
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  valueClassName,
  iconContainerClass,
  iconClass,
  subtitle,
  ariaLabel,
}: SummaryCardProps) {
  return (
    <article
      aria-label={ariaLabel ?? label}
      className="relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius)] border border-border bg-card transition-all duration-200 hover:border-ring/40 hover:shadow-[0_4px_6px_-1px_rgb(0_0_0/0.05),0_2px_4px_-2px_rgb(0_0_0/0.05)]"
      style={{ padding: '1.5rem' }}
    >
      <div
        className={cn('flex h-10 w-10 items-center justify-center rounded-xl', iconContainerClass)}
        style={{ marginBottom: '0.25rem' }}
      >
        <Icon className={cn('h-5 w-5', iconClass)} />
      </div>
      <span
        className="text-muted-foreground"
        style={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        {label}
      </span>
      <div
        className={cn('tabular-nums text-foreground', valueClassName ?? '')}
        style={{ fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.2, marginTop: '0.125rem' }}
      >
        {value}
      </div>
      {subtitle && (
        <span
          className="text-muted-foreground"
          style={{ fontSize: '0.75rem', lineHeight: 1.4, marginTop: '0.25rem' }}
        >
          {subtitle}
        </span>
      )}
    </article>
  )
}

function SummaryCardSkeleton() {
  return (
    <article
      className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card"
      style={{ padding: '1.5rem' }}
    >
      <div
        className="h-10 w-10 animate-pulse rounded-xl bg-muted"
        style={{ marginBottom: '0.25rem' }}
      />
      <div className="h-[0.8125rem] w-[60%] animate-pulse rounded bg-muted" />
      <div
        className="h-[1.875rem] w-[80%] animate-pulse rounded bg-muted"
        style={{ marginTop: '0.125rem' }}
      />
      <div
        className="h-[0.75rem] w-[70%] animate-pulse rounded bg-muted"
        style={{ marginTop: '0.25rem' }}
      />
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Bar chart — Receitas vs Despesas                                    */
/* ------------------------------------------------------------------ */

interface BarChartProps {
  revenue: DailyPoint[]
  expenses: DailyPoint[]
  ifoodCommission: DailyPoint[]
}

function RevenueExpenseChart({ revenue, expenses, ifoodCommission }: BarChartProps) {
  const hasData =
    revenue.some((p) => p.value > 0) ||
    expenses.some((p) => p.value > 0) ||
    ifoodCommission.some((p) => p.value > 0)
  const max = useMemo(() => {
    const m = Math.max(
      0,
      ...revenue.map((p) => p.value),
      ...expenses.map((p) => p.value),
      ...ifoodCommission.map((p) => p.value),
    )
    return m > 0 ? m : 1
  }, [revenue, expenses, ifoodCommission])

  if (!hasData) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground"
        style={{ minHeight: 280 }}
      >
        <BarChart3 className="h-8 w-8" />
        <span style={{ fontSize: '0.8125rem' }}>Sem dados para o período selecionado.</span>
      </div>
    )
  }

  return (
    <div>
      <div
        className="flex items-end justify-around gap-2"
        style={{ height: 280, overflowX: 'auto', padding: '1rem 0' }}
        role="img"
        aria-label="Gráfico de receitas, despesas e comissão iFood por período"
      >
        {revenue.map((point, i) => {
          const exp = expenses[i]?.value ?? 0
          const com = ifoodCommission[i]?.value ?? 0
          const revH = Math.max((point.value / max) * 100, point.value > 0 ? 4 / 2.8 : 0)
          const expH = Math.max((exp / max) * 100, exp > 0 ? 4 / 2.8 : 0)
          const comH = Math.max((com / max) * 100, com > 0 ? 4 / 2.8 : 0)
          return (
            <div
              key={i}
              className="flex min-w-[2.5rem] flex-col items-center"
              style={{ height: '100%' }}
            >
              <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                <div className="flex h-full flex-col items-center justify-end">
                  {point.value > 0 && (
                    <span
                      className="text-muted-foreground tabular-nums"
                      style={{ fontSize: '0.625rem', lineHeight: 1 }}
                    >
                      {formatBRL(point.value)}
                    </span>
                  )}
                  <div
                    className="w-[6px] rounded-t sm:w-[10px]"
                    style={{
                      height: `${revH}%`,
                      backgroundColor: 'hsl(142 70% 45%)',
                      minHeight: point.value > 0 ? 4 : 0,
                    }}
                    title={`Receitas: ${formatBRL(point.value)}`}
                  />
                </div>
                <div className="flex h-full flex-col items-center justify-end">
                  {exp > 0 && (
                    <span
                      className="text-muted-foreground tabular-nums"
                      style={{ fontSize: '0.625rem', lineHeight: 1 }}
                    >
                      {formatBRL(exp)}
                    </span>
                  )}
                  <div
                    className="w-[6px] rounded-t sm:w-[10px]"
                    style={{
                      height: `${expH}%`,
                      backgroundColor: 'var(--destructive)',
                      minHeight: exp > 0 ? 4 : 0,
                    }}
                    title={`Despesas: ${formatBRL(exp)}`}
                  />
                </div>
                <div className="flex h-full flex-col items-center justify-end">
                  {com > 0 && (
                    <span
                      className="text-muted-foreground tabular-nums"
                      style={{ fontSize: '0.625rem', lineHeight: 1 }}
                    >
                      {formatBRL(com)}
                    </span>
                  )}
                  <div
                    className="w-[6px] rounded-t sm:w-[10px]"
                    style={{
                      height: `${comH}%`,
                      backgroundColor: 'hsl(30 80% 50%)',
                      minHeight: com > 0 ? 4 : 0,
                    }}
                    title={`Comissão iFood: ${formatBRL(com)}`}
                  />
                </div>
              </div>
              <span
                className="text-center text-muted-foreground tabular-nums"
                style={{ fontSize: '0.6875rem', marginTop: '0.5rem', whiteSpace: 'nowrap' }}
              >
                {point.date}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4" style={{ marginTop: '0.75rem' }}>
        <span
          className="flex items-center gap-2 text-muted-foreground"
          style={{ fontSize: '0.75rem' }}
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(142 70% 45%)' }} />
          Receitas
        </span>
        <span
          className="flex items-center gap-2 text-muted-foreground"
          style={{ fontSize: '0.75rem' }}
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: 'var(--destructive)' }}
          />
          Despesas
        </span>
        <span
          className="flex items-center gap-2 text-muted-foreground"
          style={{ fontSize: '0.75rem' }}
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(30 80% 50%)' }} />
          Comissão iFood
        </span>
      </div>
      {/* Visually hidden summary table for screen readers */}
      <table className="sr-only">
        <caption>Receitas, despesas e comissão iFood por período</caption>
        <thead>
          <tr>
            <th>Período</th>
            <th>Receitas</th>
            <th>Despesas</th>
            <th>Comissão iFood</th>
          </tr>
        </thead>
        <tbody>
          {revenue.map((p, i) => (
            <tr key={i}>
              <td>{p.date}</td>
              <td>{formatBRL(p.value)}</td>
              <td>{formatBRL(expenses[i]?.value ?? 0)}</td>
              <td>{formatBRL(ifoodCommission[i]?.value ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div
      className="flex items-end justify-around gap-2"
      style={{ height: 280, padding: '1rem 0' }}
      aria-hidden="true"
    >
      {[40, 65, 30, 80, 50, 20, 70].map((h, i) => (
        <div
          key={i}
          className="flex min-w-[2.5rem] flex-col items-center"
          style={{ height: '100%' }}
        >
          <div className="flex w-full flex-1 items-end justify-center gap-0.5">
            <div
              className="w-[6px] animate-pulse rounded-t bg-muted sm:w-[10px]"
              style={{ height: `${h}%`, minHeight: 4 }}
            />
            <div
              className="w-[6px] animate-pulse rounded-t bg-muted sm:w-[10px]"
              style={{ height: `${h * 0.6}%`, minHeight: 4 }}
            />
            <div
              className="w-[6px] animate-pulse rounded-t bg-muted sm:w-[10px]"
              style={{ height: `${h * 0.4}%`, minHeight: 4 }}
            />
          </div>
          <div className="mt-2 h-2 w-10 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Donut chart — Formas de Pagamento                                   */
/* ------------------------------------------------------------------ */

const PAYMENT_META: { key: keyof PaymentBreakdown; label: string; color: string }[] = [
  { key: 'dinheiro', label: 'Dinheiro', color: 'hsl(142 70% 45%)' },
  { key: 'cartao', label: 'Cartão', color: 'hsl(215 25% 50%)' },
  { key: 'pix', label: 'Pix', color: 'hsl(265 70% 55%)' },
]

function PaymentDonutChart({ breakdown }: { breakdown: PaymentBreakdown }) {
  const total = breakdown.dinheiro + breakdown.cartao + breakdown.pix

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center text-center text-muted-foreground"
        style={{ minHeight: 240 }}
      >
        Sem vendas no período.
      </div>
    )
  }

  const dPct = (breakdown.dinheiro / total) * 100
  const cPct = (breakdown.cartao / total) * 100
  const gradient = `conic-gradient(hsl(142 70% 45%) 0% ${dPct}%, hsl(215 25% 50%) ${dPct}% ${dPct + cPct}%, hsl(265 70% 55%) ${dPct + cPct}% 100%)`

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative rounded-full"
        style={{ width: 160, height: 160, background: gradient }}
        role="img"
        aria-label="Formas de pagamento"
      >
        <div
          className="absolute flex items-center justify-center rounded-full"
          style={{
            width: 80,
            height: 80,
            top: 40,
            left: 40,
            backgroundColor: 'var(--card)',
          }}
        >
          <div className="text-center">
            <div className="text-muted-foreground" style={{ fontSize: '0.625rem' }}>
              Total
            </div>
            <div
              className="tabular-nums text-foreground"
              style={{ fontSize: '0.6875rem', fontWeight: 700 }}
            >
              {formatBRL(total)}
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2" style={{ marginTop: '1rem' }}>
        {PAYMENT_META.map((meta) => (
          <div key={meta.key} className="flex items-center justify-between">
            <span
              className="flex items-center gap-2"
              style={{ fontSize: '0.8125rem', fontWeight: 500 }}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.label}
            </span>
            <div className="text-right">
              <div
                className="tabular-nums text-foreground"
                style={{ fontSize: '0.8125rem', fontWeight: 600 }}
              >
                {formatBRL(breakdown[meta.key])}
              </div>
              <div className="text-muted-foreground" style={{ fontSize: '0.6875rem' }}>
                {formatPercent(breakdown[meta.key], total)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Formas de pagamento</caption>
        <thead>
          <tr>
            <th>Forma</th>
            <th>Valor</th>
            <th>Percentual</th>
          </tr>
        </thead>
        <tbody>
          {PAYMENT_META.map((meta) => (
            <tr key={meta.key}>
              <td>{meta.label}</td>
              <td>{formatBRL(breakdown[meta.key])}</td>
              <td>{formatPercent(breakdown[meta.key], total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DonutSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4" aria-hidden="true">
      <div className="animate-pulse rounded-full bg-muted" style={{ width: 160, height: 160 }} />
      <div className="flex w-full flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Top products table                                                  */
/* ------------------------------------------------------------------ */

function TopProductsTable({ products }: { products: TopProduct[] }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card sm:block">
        <table className="w-full">
          <thead>
            <tr className="bg-muted" style={{ height: '3rem' }}>
              <th
                className="text-left text-muted-foreground"
                style={{
                  padding: '0 1rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Posição
              </th>
              <th
                className="text-left text-muted-foreground"
                style={{
                  padding: '0 1rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Produto
              </th>
              <th
                className="text-right text-muted-foreground"
                style={{
                  padding: '0 1rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Quantidade Vendida
              </th>
              <th
                className="text-right text-muted-foreground"
                style={{
                  padding: '0 1rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Receita Gerada
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => (
              <tr
                key={`${p.productName}-${idx}`}
                className={cn(
                  'border-t border-border transition-colors duration-150 hover:bg-muted/50',
                  idx % 2 === 1 ? 'bg-muted/30' : 'bg-card',
                )}
                style={{ height: '3.5rem' }}
              >
                <td
                  className="text-primary tabular-nums"
                  style={{
                    padding: '0 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    width: 60,
                    verticalAlign: 'middle',
                  }}
                >
                  {idx + 1}
                </td>
                <td
                  className="text-foreground"
                  style={{
                    padding: '0 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    verticalAlign: 'middle',
                  }}
                >
                  {p.productName}
                </td>
                <td
                  className="text-right text-foreground tabular-nums"
                  style={{ padding: '0 1rem', fontSize: '0.875rem', verticalAlign: 'middle' }}
                >
                  {formatNumber(p.quantitySold)}
                </td>
                <td
                  className="text-right text-foreground tabular-nums"
                  style={{
                    padding: '0 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    verticalAlign: 'middle',
                  }}
                >
                  {formatBRL(p.totalRevenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 sm:hidden">
        {products.map((p, idx) => (
          <div
            key={`${p.productName}-${idx}`}
            className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card"
            style={{ padding: '1rem' }}
          >
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-primary"
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                backgroundColor: 'hsl(var(--primary) / 0.15)',
              }}
            >
              {idx + 1}
            </span>
            <div className="flex flex-1 flex-col gap-0.5" style={{ minWidth: 0 }}>
              <span className="text-foreground" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                {p.productName}
              </span>
              <span className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                {formatNumber(p.quantitySold)} un. ·{' '}
                <span className="font-semibold text-foreground">{formatBRL(p.totalRevenue)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function TopProductsSkeleton() {
  return (
    <>
      {/* Desktop skeleton table */}
      <div
        className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card sm:block"
        aria-hidden="true"
      >
        <table className="w-full">
          <thead>
            <tr className="bg-muted" style={{ height: '3rem' }}>
              <th style={{ padding: '0 1rem' }} />
              <th style={{ padding: '0 1rem' }} />
              <th style={{ padding: '0 1rem' }} />
              <th style={{ padding: '0 1rem' }} />
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map((i) => (
              <tr key={i} className="border-t border-border" style={{ height: '3.5rem' }}>
                <td style={{ padding: '0 1rem' }}>
                  <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                </td>
                <td style={{ padding: '0 1rem' }}>
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                </td>
                <td style={{ padding: '0 1rem', textAlign: 'right' }}>
                  <div className="ml-auto h-4 w-12 animate-pulse rounded bg-muted" />
                </td>
                <td style={{ padding: '0 1rem', textAlign: 'right' }}>
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile skeleton cards */}
      <div className="flex flex-col gap-2 sm:hidden" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card"
            style={{ padding: '1rem' }}
          >
            <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex flex-1 flex-col gap-1">
              <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Empty / error states                                                */
/* ------------------------------------------------------------------ */

function EmptyPeriodState({ start, end }: { start: string; end: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '3rem 1.5rem', minHeight: 400 }}
    >
      <BarChart3 className="h-16 w-16 text-muted-foreground" style={{ marginBottom: '1.5rem' }} />
      <h2 className="text-foreground" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
        Sem dados no período
      </h2>
      <p className="text-muted-foreground" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
        Não há vendas ou compras registradas entre {formatBR(start)} e {formatBR(end)}.
      </p>
      <p
        className="italic text-muted-foreground"
        style={{ fontSize: '0.8125rem', marginTop: '0.75rem' }}
      >
        Tente selecionar um período diferente.
      </p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 text-center"
      style={{ padding: '3rem 1.5rem' }}
    >
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="text-foreground" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
        Erro ao gerar relatório
      </h2>
      <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
        Não foi possível carregar os dados do período selecionado.
      </p>
      <Button
        variant="outline"
        className="h-11 gap-2 px-6"
        onClick={onRetry}
        aria-label="Tentar novamente"
      >
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  )
}

function ProductsEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '3rem 1.5rem' }}
    >
      <BarChart3 className="h-12 w-12 text-muted-foreground" />
      <h3
        className="text-foreground"
        style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: '1rem' }}
      >
        Nenhum produto vendido no período
      </h3>
      <p className="text-muted-foreground" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
        Não há vendas registradas no período selecionado.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Quick filter button                                                 */
/* ------------------------------------------------------------------ */

function QuickFilterButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-[var(--radius)] border px-3.5 text-[0.8125rem] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-muted/30 hover:text-foreground hover:border-ring/40',
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Comparison mode — view components                                   */
/* ------------------------------------------------------------------ */

const METRIC_LABELS = {
  receita: 'Receita Total',
  despesa: 'Despesa Total',
  comissao: 'Comissão iFood',
  lucro: 'Lucro Líquido',
  ticket: 'Ticket Médio',
} as const

interface ComparisonCardProps {
  label: string
  valueA: number
  valueB: number
}

function ComparisonCard({ label, valueA, valueB }: ComparisonCardProps) {
  const v = computeVariation(valueA, valueB)
  const TrendIcon =
    v.direction === 'up' ? TrendingUp : v.direction === 'down' ? TrendingDown : Minus
  const trendColor =
    v.direction === 'up'
      ? 'text-[hsl(142,70%,35%)] dark:text-[hsl(142,70%,55%)]'
      : v.direction === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground'

  return (
    <article
      aria-label={label}
      className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card"
      style={{ padding: '1.5rem' }}
    >
      <span
        className="text-muted-foreground"
        style={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        {label}
      </span>

      <div className="grid grid-cols-2 gap-2">
        {/* Period A */}
        <div className="flex flex-col">
          <span
            className="text-muted-foreground"
            style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase' }}
          >
            Período A
          </span>
          <span
            className="tabular-nums text-foreground"
            style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2, marginTop: '0.25rem' }}
          >
            {formatBRL(valueA)}
          </span>
        </div>
        {/* Period B */}
        <div className="flex flex-col border-l border-border pl-2">
          <span
            className="text-muted-foreground"
            style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase' }}
          >
            Período B
          </span>
          <span
            className="tabular-nums text-foreground"
            style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2, marginTop: '0.25rem' }}
          >
            {formatBRL(valueB)}
          </span>
        </div>
      </div>

      {/* Variation */}
      <div
        className="flex items-center gap-1.5 border-t border-border pt-2"
        style={{ marginTop: '0.25rem' }}
      >
        {v.direction === 'noB' ? (
          <span className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
            Sem dados no período B
          </span>
        ) : (
          <>
            <TrendIcon className={cn('h-4 w-4', trendColor)} />
            <span
              className={cn('tabular-nums', trendColor)}
              style={{ fontSize: '0.8125rem', fontWeight: 600 }}
            >
              {formatSignedBRL(v.diff)}
            </span>
            <span className={cn('tabular-nums', trendColor)} style={{ fontSize: '0.75rem' }}>
              ({formatSignedPct(v.pct)})
            </span>
          </>
        )}
      </div>
    </article>
  )
}

function ComparisonCardSkeleton() {
  return (
    <article
      className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card"
      style={{ padding: '1.5rem' }}
      aria-hidden="true"
    >
      <div className="h-[0.8125rem] w-[60%] animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <div className="h-[0.6875rem] w-[50%] animate-pulse rounded bg-muted" />
          <div className="h-[1.25rem] w-[80%] animate-pulse rounded bg-muted" />
        </div>
        <div className="flex flex-col gap-1 border-l border-border pl-2">
          <div className="h-[0.6875rem] w-[50%] animate-pulse rounded bg-muted" />
          <div className="h-[1.25rem] w-[80%] animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="h-[0.8125rem] w-[70%] animate-pulse rounded bg-muted border-t border-border pt-2" />
    </article>
  )
}

/* Comparison grouped bar chart */
interface ComparisonChartProps {
  data: ComparisonData
}

function ComparisonChart({ data }: ComparisonChartProps) {
  const groups = [
    { label: 'Receitas', a: data.receitaA, b: data.receitaB, color: 'hsl(142 70% 45%)' },
    { label: 'Despesas', a: data.despesaA, b: data.despesaB, color: 'var(--destructive)' },
    { label: 'Comissão iFood', a: data.comissaoA, b: data.comissaoB, color: 'hsl(30 80% 50%)' },
  ]
  const max = useMemo(() => {
    const m = Math.max(1, ...groups.map((g) => g.a), ...groups.map((g) => g.b))
    return m > 0 ? m : 1
  }, [groups])

  return (
    <div>
      <div
        className="flex items-end justify-around gap-3"
        style={{ height: 280, overflowX: 'auto', padding: '1rem 0' }}
        role="img"
        aria-label="Comparativo de receitas, despesas e comissão iFood entre os dois períodos"
      >
        {groups.map((g) => {
          const aH = Math.max((g.a / max) * 100, g.a > 0 ? 4 / 2.8 : 0)
          const bH = Math.max((g.b / max) * 100, g.b > 0 ? 4 / 2.8 : 0)
          return (
            <div
              key={g.label}
              className="flex min-w-[4rem] flex-col items-center"
              style={{ height: '100%' }}
            >
              <div className="flex w-full flex-1 items-end justify-center gap-2">
                {/* Period A bar */}
                <div className="flex h-full flex-col items-center justify-end">
                  {g.a > 0 && (
                    <span
                      className="text-muted-foreground tabular-nums"
                      style={{ fontSize: '0.625rem', lineHeight: 1 }}
                    >
                      {formatBRL(g.a)}
                    </span>
                  )}
                  <div
                    className="w-[14px] rounded-t sm:w-[20px]"
                    style={{
                      height: `${aH}%`,
                      backgroundColor: g.color,
                      minHeight: g.a > 0 ? 4 : 0,
                    }}
                    title={`Período A — ${g.label}: ${formatBRL(g.a)}`}
                  />
                </div>
                {/* Period B bar */}
                <div className="flex h-full flex-col items-center justify-end">
                  {g.b > 0 && (
                    <span
                      className="text-muted-foreground tabular-nums"
                      style={{ fontSize: '0.625rem', lineHeight: 1 }}
                    >
                      {formatBRL(g.b)}
                    </span>
                  )}
                  <div
                    className="w-[14px] rounded-t sm:w-[20px]"
                    style={{
                      height: `${bH}%`,
                      backgroundColor: g.color,
                      opacity: 0.55,
                      minHeight: g.b > 0 ? 4 : 0,
                    }}
                    title={`Período B — ${g.label}: ${formatBRL(g.b)}`}
                  />
                </div>
              </div>
              <span
                className="text-center text-muted-foreground"
                style={{ fontSize: '0.6875rem', marginTop: '0.5rem', whiteSpace: 'nowrap' }}
              >
                {g.label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4" style={{ marginTop: '0.75rem' }}>
        <span
          className="flex items-center gap-2 text-muted-foreground"
          style={{ fontSize: '0.75rem' }}
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(142 70% 45%)' }} />
          Receitas
        </span>
        <span
          className="flex items-center gap-2 text-muted-foreground"
          style={{ fontSize: '0.75rem' }}
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: 'var(--destructive)' }}
          />
          Despesas
        </span>
        <span
          className="flex items-center gap-2 text-muted-foreground"
          style={{ fontSize: '0.75rem' }}
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(30 80% 50%)' }} />
          Comissão iFood
        </span>
        <span
          className="flex items-center gap-2 text-muted-foreground"
          style={{ fontSize: '0.75rem', marginLeft: 'auto' }}
        >
          <span className="h-3 w-3 rounded-full bg-foreground" />
          Período A
        </span>
        <span
          className="flex items-center gap-2 text-muted-foreground"
          style={{ fontSize: '0.75rem' }}
        >
          <span className="h-3 w-3 rounded-full bg-foreground" style={{ opacity: 0.55 }} />
          Período B
        </span>
      </div>

      <table className="sr-only">
        <caption>Comparativo de receitas, despesas e comissão iFood</caption>
        <thead>
          <tr>
            <th>Indicador</th>
            <th>Período A</th>
            <th>Período B</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.label}>
              <td>{g.label}</td>
              <td>{formatBRL(g.a)}</td>
              <td>{formatBRL(g.b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* Comparison top products table */
function ComparisonProductsTable({ rows }: { rows: ComparisonProductRow[] }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-[var(--radius)] border border-border bg-card sm:block">
        <table className="w-full">
          <thead>
            <tr className="bg-muted" style={{ height: '3rem' }}>
              {[
                'Posição',
                'Produto',
                'Qtd A',
                'Receita A',
                'Qtd B',
                'Receita B',
                'Variação Qtd',
                'Variação Receita',
              ].map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    'text-muted-foreground',
                    i === 0 || i === 1
                      ? 'text-left'
                      : i === 2 || i === 4
                        ? 'text-center'
                        : 'text-right',
                  )}
                  style={{
                    padding: '0 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, idx) => {
              const vQ = computeVariation(p.quantityA, p.quantityB)
              const vR = computeVariation(p.revenueA, p.revenueB)
              const qColor =
                vQ.direction === 'up'
                  ? 'text-[hsl(142,70%,35%)] dark:text-[hsl(142,70%,55%)]'
                  : vQ.direction === 'down'
                    ? 'text-destructive'
                    : 'text-muted-foreground'
              const rColor =
                vR.direction === 'up'
                  ? 'text-[hsl(142,70%,35%)] dark:text-[hsl(142,70%,55%)]'
                  : vR.direction === 'down'
                    ? 'text-destructive'
                    : 'text-muted-foreground'
              const QIcon =
                vQ.direction === 'up' ? TrendingUp : vQ.direction === 'down' ? TrendingDown : Minus
              const RIcon =
                vR.direction === 'up' ? TrendingUp : vR.direction === 'down' ? TrendingDown : Minus
              return (
                <tr
                  key={`${p.productName}-${idx}`}
                  className={cn(
                    'border-t border-border transition-colors duration-150 hover:bg-muted/50',
                    idx % 2 === 1 ? 'bg-muted/30' : 'bg-card',
                  )}
                  style={{ height: '3.5rem' }}
                >
                  <td
                    className="text-primary tabular-nums"
                    style={{
                      padding: '0 0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      width: 60,
                    }}
                  >
                    {idx + 1}
                  </td>
                  <td
                    className="text-foreground"
                    style={{ padding: '0 0.75rem', fontSize: '0.875rem', fontWeight: 500 }}
                  >
                    {p.productName}
                  </td>
                  <td
                    className="text-center text-foreground tabular-nums"
                    style={{ padding: '0 0.75rem', fontSize: '0.875rem' }}
                  >
                    {formatNumber(p.quantityA)}
                  </td>
                  <td
                    className="text-right text-foreground tabular-nums"
                    style={{ padding: '0 0.75rem', fontSize: '0.875rem', fontWeight: 600 }}
                  >
                    {formatBRL(p.revenueA)}
                  </td>
                  <td
                    className="text-center text-foreground tabular-nums"
                    style={{ padding: '0 0.75rem', fontSize: '0.875rem' }}
                  >
                    {formatNumber(p.quantityB)}
                  </td>
                  <td
                    className="text-right text-foreground tabular-nums"
                    style={{ padding: '0 0.75rem', fontSize: '0.875rem', fontWeight: 600 }}
                  >
                    {formatBRL(p.revenueB)}
                  </td>
                  <td
                    className={cn('text-right tabular-nums', qColor)}
                    style={{ padding: '0 0.75rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <QIcon className="h-3.5 w-3.5" />
                      {vQ.direction === 'noB'
                        ? '—'
                        : `${vQ.diff > 0 ? '+' : vQ.diff < 0 ? '-' : ''}${formatNumber(Math.abs(vQ.diff))} (${formatSignedPct(vQ.pct)})`}
                    </span>
                  </td>
                  <td
                    className={cn('text-right tabular-nums', rColor)}
                    style={{ padding: '0 0.75rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <RIcon className="h-3.5 w-3.5" />
                      {vR.direction === 'noB'
                        ? 'Sem dados no período B'
                        : `${formatSignedBRL(vR.diff)} (${formatSignedPct(vR.pct)})`}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 sm:hidden">
        {rows.map((p, idx) => {
          const vQ = computeVariation(p.quantityA, p.quantityB)
          const vR = computeVariation(p.revenueA, p.revenueB)
          const qColor =
            vQ.direction === 'up'
              ? 'text-[hsl(142,70%,35%)] dark:text-[hsl(142,70%,55%)]'
              : vQ.direction === 'down'
                ? 'text-destructive'
                : 'text-muted-foreground'
          const rColor =
            vR.direction === 'up'
              ? 'text-[hsl(142,70%,35%)] dark:text-[hsl(142,70%,55%)]'
              : vR.direction === 'down'
                ? 'text-destructive'
                : 'text-muted-foreground'
          const QIcon =
            vQ.direction === 'up' ? TrendingUp : vQ.direction === 'down' ? TrendingDown : Minus
          const RIcon =
            vR.direction === 'up' ? TrendingUp : vR.direction === 'down' ? TrendingDown : Minus
          return (
            <div
              key={`${p.productName}-${idx}`}
              className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card"
              style={{ padding: '1rem' }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-primary"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    backgroundColor: 'hsl(var(--primary) / 0.15)',
                  }}
                >
                  {idx + 1}
                </span>
                <span className="text-foreground" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  {p.productName}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div
                  className="rounded-[var(--radius)] bg-muted/30"
                  style={{ padding: '0.5rem 0.625rem' }}
                >
                  <div
                    className="text-muted-foreground"
                    style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase' }}
                  >
                    Período A
                  </div>
                  <div
                    className="text-foreground tabular-nums"
                    style={{ fontSize: '0.8125rem', fontWeight: 600 }}
                  >
                    {formatNumber(p.quantityA)} un.
                  </div>
                  <div className="text-foreground tabular-nums" style={{ fontSize: '0.75rem' }}>
                    {formatBRL(p.revenueA)}
                  </div>
                </div>
                <div
                  className="rounded-[var(--radius)] bg-muted/30"
                  style={{ padding: '0.5rem 0.625rem' }}
                >
                  <div
                    className="text-muted-foreground"
                    style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase' }}
                  >
                    Período B
                  </div>
                  <div
                    className="text-foreground tabular-nums"
                    style={{ fontSize: '0.8125rem', fontWeight: 600 }}
                  >
                    {formatNumber(p.quantityB)} un.
                  </div>
                  <div className="text-foreground tabular-nums" style={{ fontSize: '0.75rem' }}>
                    {formatBRL(p.revenueB)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1 border-t border-border pt-2">
                <span
                  className={cn('inline-flex items-center gap-1 tabular-nums', qColor)}
                  style={{ fontSize: '0.75rem' }}
                >
                  <QIcon className="h-3.5 w-3.5" />
                  Var. Qtd:{' '}
                  {vQ.direction === 'noB'
                    ? '—'
                    : `${vQ.diff > 0 ? '+' : vQ.diff < 0 ? '-' : ''}${formatNumber(Math.abs(vQ.diff))} (${formatSignedPct(vQ.pct)})`}
                </span>
                <span
                  className={cn('inline-flex items-center gap-1 tabular-nums', rColor)}
                  style={{ fontSize: '0.75rem' }}
                >
                  <RIcon className="h-3.5 w-3.5" />
                  Var. Receita:{' '}
                  {vR.direction === 'noB'
                    ? 'Sem dados no período B'
                    : `${formatSignedBRL(vR.diff)} (${formatSignedPct(vR.pct)})`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function ComparisonProductsSkeleton() {
  return (
    <>
      <div
        className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card sm:block"
        aria-hidden="true"
      >
        <table className="w-full">
          <thead>
            <tr className="bg-muted" style={{ height: '3rem' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <th key={i} style={{ padding: '0 0.75rem' }} />
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map((i) => (
              <tr key={i} className="border-t border-border" style={{ height: '3.5rem' }}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} style={{ padding: '0 0.75rem' }}>
                    <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 sm:hidden" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card"
            style={{ padding: '1rem' }}
          >
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-16 animate-pulse rounded bg-muted/40" />
              <div className="h-16 animate-pulse rounded bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/* Comparison empty / loading / error states */
function ComparisonEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '3rem 1.5rem', minHeight: 400 }}
    >
      <GitCompare className="h-16 w-16 text-muted-foreground" style={{ marginBottom: '1.5rem' }} />
      <h2 className="text-foreground" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
        Sem dados para comparar
      </h2>
      <p className="text-muted-foreground" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
        Não há vendas ou compras registradas nos períodos selecionados.
      </p>
      <p
        className="italic text-muted-foreground"
        style={{ fontSize: '0.8125rem', marginTop: '0.75rem' }}
      >
        Ajuste os períodos e gere o comparativo novamente.
      </p>
    </div>
  )
}

function ComparisonLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <ComparisonCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6" style={{ marginTop: '2rem' }}>
        <ChartCard title="Comparativo de Receitas, Despesas e Comissão">
          <ChartSkeleton />
        </ChartCard>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <h2 className="text-foreground" style={{ fontSize: '1.125rem', fontWeight: 700 }}>
          Produtos Mais Vendidos — Comparativo
        </h2>
        <div style={{ marginTop: '1rem' }}>
          <ComparisonProductsSkeleton />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type ReportMode = 'relatorio' | 'comparativo'

/** Shift a [start, end] range backwards by its own length (immediately
 * preceding period of the same length). Returns a new range. */
function precedingRange(start: string, end: string): { start: string; end: string } {
  const startMs = new Date(`${start}T00:00:00`).getTime()
  const endMs = new Date(`${end}T00:00:00`).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return { start, end }
  }
  const dayMs = 86400000
  const lengthDays = Math.round((endMs - startMs) / dayMs)
  const newEndMs = startMs - dayMs
  const newStartMs = newEndMs - lengthDays * dayMs
  const toYmd = (ms: number) => {
    const d = new Date(ms)
    return toYMD(d)
  }
  return { start: toYmd(newStartMs), end: toYmd(newEndMs) }
}

type ComparisonPreset = 'semana' | 'mes' | '30dias'

function comparisonPresetRanges(preset: ComparisonPreset): {
  startA: string
  endA: string
  startB: string
  endB: string
} {
  const today = todayYMD()
  let startA: string
  // endA is always "today" for these presets.
  if (preset === 'semana') {
    startA = daysAgoYMD(6)
  } else if (preset === 'mes') {
    startA = firstDayOfMonthYMD()
  } else {
    startA = daysAgoYMD(29)
  }
  const b = precedingRange(startA, today)
  return { startA, endA: today, startB: b.start, endB: b.end }
}

export default function ReportsPage() {
  const { reportData, loading, error, refresh } = useReports()
  const { settings } = useStoreSettings()
  const { toast } = useToast()

  const storeName = settings.storeName || 'Minha Loja'

  // Mode toggle: 'relatorio' (default) or 'comparativo'.
  const [mode, setMode] = useState<ReportMode>('relatorio')

  const [startInput, setStartInput] = useState<string>(firstDayOfMonthYMD())
  const [endInput, setEndInput] = useState<string>(todayYMD())
  const [activeStart, setActiveStart] = useState<string>(firstDayOfMonthYMD())
  const [activeEnd, setActiveEnd] = useState<string>(todayYMD())
  const [hasGenerated, setHasGenerated] = useState(false)

  // Comparison-mode state.
  const [cmpStartA, setCmpStartA] = useState<string>(daysAgoYMD(6))
  const [cmpEndA, setCmpEndA] = useState<string>(todayYMD())
  const [cmpStartB, setCmpStartB] = useState<string>(
    () => precedingRange(daysAgoYMD(6), todayYMD()).start,
  )
  const [cmpEndB, setCmpEndB] = useState<string>(
    () => precedingRange(daysAgoYMD(6), todayYMD()).end,
  )
  const [cmpActive, setCmpActive] = useState<{
    startA: string
    endA: string
    startB: string
    endB: string
  } | null>(null)
  const [cmpLoading, setCmpLoading] = useState(false)
  const [cmpError, setCmpError] = useState<string | null>(null)
  const [cmpData, setCmpData] = useState<ComparisonData | null>(null)

  const invalidRange = startInput > endInput
  const invalidCmpA = cmpStartA > cmpEndA
  const invalidCmpB = cmpStartB > cmpEndB

  const currentPreset = useMemo<Preset | null>(() => {
    const presets: Preset[] = ['hoje', '7dias', 'mes', '30dias']
    for (const p of presets) {
      const { start, end } = presetRange(p)
      if (start === activeStart && end === activeEnd) return p
    }
    return null
  }, [activeStart, activeEnd])

  const runReport = useCallback(
    (start: string, end: string) => {
      setActiveStart(start)
      setActiveEnd(end)
      setHasGenerated(true)
      void refresh(start, end)
    },
    [refresh],
  )

  // Initial report load on mount.
  useEffect(() => {
    runReport(firstDayOfMonthYMD(), todayYMD())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = () => {
    if (invalidRange) return
    runReport(startInput, endInput)
  }

  const handlePreset = (preset: Preset) => {
    const { start, end } = presetRange(preset)
    setStartInput(start)
    setEndInput(end)
    runReport(start, end)
  }

  const handleExport = () => {
    if (!reportData || reportData.topProducts.length === 0) return
    exportProductsCsv(reportData.topProducts)
    toast({ title: 'Relatório exportado com sucesso.' })
  }

  const handleExportPdf = () => {
    if (!reportData) return
    if (reportData.salesCount === 0 && reportData.purchasesCount === 0) return
    const ok = exportReportPdf(reportData, activeStart, activeEnd, storeName)
    if (!ok) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível abrir a janela de impressão.',
        description: 'Permita popups para este site.',
      })
      return
    }
    toast({ title: 'Abrindo janela de impressão...' })
  }

  /* ----- Comparison handlers ----- */

  const runComparison = useCallback(
    async (startA: string, endA: string, startB: string, endB: string) => {
      setCmpActive({ startA, endA, startB, endB })
      setCmpLoading(true)
      setCmpError(null)
      try {
        const [allSales, allPurchases, allSaleItems, products] = await Promise.all([
          listAllSales(),
          listPurchases(),
          listAllSaleItems(),
          listProducts(),
        ])
        setCmpData(
          buildComparisonData(
            allSales,
            allPurchases,
            allSaleItems,
            products,
            startA,
            endA,
            startB,
            endB,
          ),
        )
      } catch (err) {
        setCmpError(
          err instanceof Error && err.message
            ? err.message
            : 'Não foi possível carregar os dados para o comparativo.',
        )
        setCmpData(null)
      } finally {
        setCmpLoading(false)
      }
    },
    [],
  )

  const handleGenerateComparison = () => {
    if (invalidCmpA || invalidCmpB) return
    void runComparison(cmpStartA, cmpEndA, cmpStartB, cmpEndB)
  }

  const handleComparisonPreset = (preset: ComparisonPreset) => {
    const r = comparisonPresetRanges(preset)
    setCmpStartA(r.startA)
    setCmpEndA(r.endA)
    setCmpStartB(r.startB)
    setCmpEndB(r.endB)
    void runComparison(r.startA, r.endA, r.startB, r.endB)
  }

  // Auto-sync Periodo B to the immediately preceding period whenever Periodo A
  // changes — but only while the user hasn't explicitly edited B. We track
  // this with a "B is in sync" heuristic: if B currently equals the preceding
  // range of the previous A, keep it in sync.
  const prevARef = useRef<{ start: string; end: string } | null>(null)
  useEffect(() => {
    const prev = prevARef.current
    if (!prev) {
      prevARef.current = { start: cmpStartA, end: cmpEndA }
      return
    }
    const aChanged = prev.start !== cmpStartA || prev.end !== cmpEndA
    if (!aChanged) return
    // Was B in sync with the PREVIOUS A?
    const expectedPrevB = precedingRange(prev.start, prev.end)
    const bWasInSync = cmpStartB === expectedPrevB.start && cmpEndB === expectedPrevB.end
    prevARef.current = { start: cmpStartA, end: cmpEndA }
    if (bWasInSync) {
      const newB = precedingRange(cmpStartA, cmpEndA)
      setCmpStartB(newB.start)
      setCmpEndB(newB.end)
    }
  }, [cmpStartA, cmpEndA, cmpStartB, cmpEndB])

  const handleExportComparisonPdf = () => {
    if (!cmpData) return
    const ok = exportComparisonPdf(cmpData, storeName)
    if (!ok) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível abrir a janela de impressão.',
        description: 'Permita popups para este site.',
      })
      return
    }
    toast({ title: 'Abrindo janela de impressão...' })
  }

  const isEmpty =
    !loading &&
    !error &&
    reportData !== null &&
    reportData.totalRevenue === 0 &&
    reportData.totalExpenses === 0 &&
    reportData.salesCount === 0 &&
    reportData.purchasesCount === 0

  const profitColor = reportData
    ? reportData.totalProfit > 0
      ? 'text-[hsl(142,70%,35%)] dark:text-[hsl(142,70%,55%)]'
      : reportData.totalProfit < 0
        ? 'text-destructive'
        : 'text-foreground'
    : 'text-foreground'

  const cmpIsEmpty =
    !cmpLoading &&
    !cmpError &&
    cmpData !== null &&
    cmpData.receitaA === 0 &&
    cmpData.despesaA === 0 &&
    cmpData.receitaB === 0 &&
    cmpData.despesaB === 0 &&
    cmpData.products.length === 0

  return (
    <section>
      <PageHeader title="Relatórios" subtitle="Análise financeira e desempenho do seu negócio" />

      {/* Mode toggle (segmented control / tablist) */}
      <div
        role="tablist"
        aria-label="Modo de relatório"
        className="inline-flex h-11 items-center rounded-[var(--radius)] border border-border bg-muted/40 p-1"
        style={{ marginTop: '1.5rem' }}
      >
        <button
          role="tab"
          type="button"
          aria-selected={mode === 'relatorio'}
          id="tab-relatorio"
          aria-controls="panel-relatorio"
          onClick={() => setMode('relatorio')}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-[calc(var(--radius)-4px)] px-4 text-[0.8125rem] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            mode === 'relatorio'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Relatório
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={mode === 'comparativo'}
          id="tab-comparativo"
          aria-controls="panel-comparativo"
          onClick={() => setMode('comparativo')}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-[calc(var(--radius)-4px)] px-4 text-[0.8125rem] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            mode === 'comparativo'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <GitCompare className="h-4 w-4" />
          Comparativo
        </button>
      </div>

      {mode === 'relatorio' ? (
        <div role="tabpanel" id="panel-relatorio" aria-labelledby="tab-relatorio">
          {/* Period filter bar */}
          <div
            className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"
            style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}
          >
            <div className="flex flex-col">
              <label
                htmlFor="report-start"
                className="text-foreground"
                style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem' }}
              >
                De
              </label>
              <input
                id="report-start"
                type="date"
                required
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="h-11 rounded-[var(--radius)] border border-input bg-background px-3 text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                style={{ fontSize: '0.875rem' }}
              />
            </div>
            <div className="flex flex-col">
              <label
                htmlFor="report-end"
                className="text-foreground"
                style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem' }}
              >
                Até
              </label>
              <input
                id="report-end"
                type="date"
                required
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                className="h-11 rounded-[var(--radius)] border border-input bg-background px-3 text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                style={{ fontSize: '0.875rem' }}
              />
            </div>
            <Button
              className="h-11 gap-2 px-5 font-semibold transition-all duration-150 hover:brightness-[1.08] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
              onClick={handleGenerate}
              disabled={loading || invalidRange}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Filter className="h-4 w-4" />
                  Gerar Relatório
                </>
              )}
            </Button>
          </div>

          {/* Quick filters */}
          <div className="flex flex-wrap gap-2" style={{ marginTop: '0.75rem' }}>
            <QuickFilterButton
              active={currentPreset === 'hoje'}
              disabled={loading}
              onClick={() => handlePreset('hoje')}
            >
              Hoje
            </QuickFilterButton>
            <QuickFilterButton
              active={currentPreset === '7dias'}
              disabled={loading}
              onClick={() => handlePreset('7dias')}
            >
              7 Dias
            </QuickFilterButton>
            <QuickFilterButton
              active={currentPreset === 'mes'}
              disabled={loading}
              onClick={() => handlePreset('mes')}
            >
              Este Mês
            </QuickFilterButton>
            <QuickFilterButton
              active={currentPreset === '30dias'}
              disabled={loading}
              onClick={() => handlePreset('30dias')}
            >
              30 Dias
            </QuickFilterButton>
          </div>

          {invalidRange && (
            <p
              className="flex items-center gap-1.5 text-destructive"
              style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}
              role="alert"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              A data inicial não pode ser maior que a data final.
            </p>
          )}

          {/* Body */}
          {error ? (
            <ErrorState onRetry={() => runReport(activeStart, activeEnd)} />
          ) : loading && !hasGenerated ? (
            <ReportsLoading />
          ) : isEmpty ? (
            <EmptyPeriodState start={activeStart} end={activeEnd} />
          ) : (
            <ReportsBody
              data={reportData}
              loading={loading}
              start={activeStart}
              end={activeEnd}
              profitColor={profitColor}
              onExport={handleExport}
              onExportPdf={handleExportPdf}
            />
          )}
        </div>
      ) : (
        <div role="tabpanel" id="panel-comparativo" aria-labelledby="tab-comparativo">
          {/* Comparison period selectors */}
          <div
            className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6"
            style={{ marginTop: '1.5rem', marginBottom: '1rem' }}
          >
            {/* Periodo A */}
            <div className="flex flex-col gap-2 lg:flex-1">
              <span className="text-foreground" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                Período A
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex flex-col">
                  <label
                    htmlFor="cmp-start-a"
                    className="text-muted-foreground"
                    style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}
                  >
                    De
                  </label>
                  <input
                    id="cmp-start-a"
                    type="date"
                    required
                    value={cmpStartA}
                    onChange={(e) => setCmpStartA(e.target.value)}
                    className="h-11 rounded-[var(--radius)] border border-input bg-background px-3 text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                    style={{ fontSize: '0.875rem' }}
                  />
                </div>
                <div className="flex flex-col">
                  <label
                    htmlFor="cmp-end-a"
                    className="text-muted-foreground"
                    style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}
                  >
                    Até
                  </label>
                  <input
                    id="cmp-end-a"
                    type="date"
                    required
                    value={cmpEndA}
                    onChange={(e) => setCmpEndA(e.target.value)}
                    className="h-11 rounded-[var(--radius)] border border-input bg-background px-3 text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                    style={{ fontSize: '0.875rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Periodo B */}
            <div className="flex flex-col gap-2 lg:flex-1">
              <span className="text-foreground" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                Período B
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex flex-col">
                  <label
                    htmlFor="cmp-start-b"
                    className="text-muted-foreground"
                    style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}
                  >
                    De
                  </label>
                  <input
                    id="cmp-start-b"
                    type="date"
                    required
                    value={cmpStartB}
                    onChange={(e) => setCmpStartB(e.target.value)}
                    className="h-11 rounded-[var(--radius)] border border-input bg-background px-3 text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                    style={{ fontSize: '0.875rem' }}
                  />
                </div>
                <div className="flex flex-col">
                  <label
                    htmlFor="cmp-end-b"
                    className="text-muted-foreground"
                    style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}
                  >
                    Até
                  </label>
                  <input
                    id="cmp-end-b"
                    type="date"
                    required
                    value={cmpEndB}
                    onChange={(e) => setCmpEndB(e.target.value)}
                    className="h-11 rounded-[var(--radius)] border border-input bg-background px-3 text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                    style={{ fontSize: '0.875rem' }}
                  />
                </div>
              </div>
            </div>

            <Button
              className="h-11 gap-2 px-5 font-semibold transition-all duration-150 hover:brightness-[1.08] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
              onClick={handleGenerateComparison}
              disabled={cmpLoading || invalidCmpA || invalidCmpB}
            >
              {cmpLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Comparando...
                </>
              ) : (
                <>
                  <Filter className="h-4 w-4" />
                  Gerar Comparativo
                </>
              )}
            </Button>
          </div>

          {/* Comparison quick filters */}
          <div className="flex flex-wrap gap-2" style={{ marginBottom: '1rem' }}>
            <QuickFilterButton
              active={false}
              disabled={cmpLoading}
              onClick={() => handleComparisonPreset('semana')}
            >
              Semana atual vs anterior
            </QuickFilterButton>
            <QuickFilterButton
              active={false}
              disabled={cmpLoading}
              onClick={() => handleComparisonPreset('mes')}
            >
              Mês atual vs anterior
            </QuickFilterButton>
            <QuickFilterButton
              active={false}
              disabled={cmpLoading}
              onClick={() => handleComparisonPreset('30dias')}
            >
              Últimos 30 dias vs anteriores 30 dias
            </QuickFilterButton>
          </div>

          {(invalidCmpA || invalidCmpB) && (
            <p
              className="flex items-center gap-1.5 text-destructive"
              style={{ marginTop: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8125rem' }}
              role="alert"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              A data inicial não pode ser maior que a data final.
            </p>
          )}

          {/* Comparison body */}
          {cmpError ? (
            <ErrorState
              onRetry={() =>
                cmpActive &&
                runComparison(cmpActive.startA, cmpActive.endA, cmpActive.startB, cmpActive.endB)
              }
            />
          ) : cmpLoading && !cmpData ? (
            <ComparisonLoading />
          ) : cmpIsEmpty ? (
            <ComparisonEmptyState />
          ) : cmpData ? (
            <ComparisonBody
              data={cmpData}
              loading={cmpLoading}
              onExportPdf={handleExportComparisonPdf}
            />
          ) : (
            <ComparisonEmptyState />
          )}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Comparison body composite                                           */
/* ------------------------------------------------------------------ */

interface ComparisonBodyProps {
  data: ComparisonData
  loading: boolean
  onExportPdf: () => void
}

function ComparisonBody({ data, loading, onExportPdf }: ComparisonBodyProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Comparison summary cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <ComparisonCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <ComparisonCard
            label={METRIC_LABELS.receita}
            valueA={data.receitaA}
            valueB={data.receitaB}
          />
          <ComparisonCard
            label={METRIC_LABELS.despesa}
            valueA={data.despesaA}
            valueB={data.despesaB}
          />
          <ComparisonCard
            label={METRIC_LABELS.comissao}
            valueA={data.comissaoA}
            valueB={data.comissaoB}
          />
          <ComparisonCard label={METRIC_LABELS.lucro} valueA={data.lucroA} valueB={data.lucroB} />
          <ComparisonCard
            label={METRIC_LABELS.ticket}
            valueA={data.ticketA}
            valueB={data.ticketB}
          />
        </div>
      )}

      {/* Comparison chart */}
      <div style={{ marginTop: '2rem' }}>
        <ChartCard title="Comparativo de Receitas, Despesas e Comissão">
          {loading ? <ChartSkeleton /> : <ComparisonChart data={data} />}
        </ChartCard>
      </div>

      {/* Comparison top products */}
      <div style={{ marginTop: '2rem' }}>
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: '1rem' }}>
          <h2 className="text-foreground" style={{ fontSize: '1.125rem', fontWeight: 700 }}>
            Produtos Mais Vendidos — Comparativo
          </h2>
          <Button
            variant="outline"
            className="h-10 gap-2 px-4 text-[0.8125rem] font-medium hover:bg-muted/30 hover:border-ring/40 focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-50"
            onClick={onExportPdf}
            disabled={loading}
            aria-label="Exportar relatório comparativo em PDF"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Exportar PDF
          </Button>
        </div>
        <div>
          {loading ? (
            <ComparisonProductsSkeleton />
          ) : data.products.length > 0 ? (
            <ComparisonProductsTable rows={data.products} />
          ) : (
            <ProductsEmptyState />
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Loading + body composites                                           */
/* ------------------------------------------------------------------ */

function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <SummaryCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6" style={{ marginTop: '2rem' }}>
        <ChartCard title="Receitas vs Despesas">
          <ChartSkeleton />
        </ChartCard>
        <ChartCard title="Formas de Pagamento">
          <DonutSkeleton />
        </ChartCard>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <h2 className="text-foreground" style={{ fontSize: '1.125rem', fontWeight: 700 }}>
          Produtos Mais Vendidos
        </h2>
        <div style={{ marginTop: '1rem' }}>
          <TopProductsSkeleton />
        </div>
      </div>
    </div>
  )
}

interface ReportsBodyProps {
  data: ReportData | null
  loading: boolean
  start: string
  end: string
  profitColor: string
  onExport: () => void
  onExportPdf: () => void
}

function ReportsBody({ data, loading, profitColor, onExport, onExportPdf }: ReportsBodyProps) {
  const profit = data?.totalProfit ?? 0
  const profitIconContainer =
    profit > 0
      ? 'bg-[hsl(142,70%,45%,0.15)]'
      : profit < 0
        ? 'bg-[hsl(var(--destructive)/0.15)]'
        : 'bg-muted'
  const profitIconClass =
    profit > 0
      ? 'text-[hsl(142,70%,45%)]'
      : profit < 0
        ? 'text-destructive'
        : 'text-muted-foreground'

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <SummaryCardSkeleton key={i} />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <SummaryCard
            icon={TrendingUp}
            label="Receita Total"
            value={formatBRL(data.totalRevenue)}
            iconContainerClass="bg-[hsl(142,70%,45%,0.15)]"
            iconClass="text-[hsl(142,70%,45%)]"
            subtitle={
              <>
                <span className="font-semibold text-foreground">{data.salesCount}</span>{' '}
                <span className="text-muted-foreground">venda(s)</span>
              </>
            }
          />
          <SummaryCard
            icon={TrendingDown}
            label="Despesa Total"
            value={formatBRL(data.totalExpenses)}
            iconContainerClass="bg-[hsl(var(--destructive)/0.15)]"
            iconClass="text-destructive"
            subtitle={
              <>
                <span className="font-semibold text-foreground">{data.purchasesCount}</span>{' '}
                <span className="text-muted-foreground">compra(s)</span>
              </>
            }
          />
          <SummaryCard
            icon={Wallet}
            label="Lucro"
            value={formatBRL(data.totalProfit)}
            valueClassName={profitColor}
            iconContainerClass={profitIconContainer}
            iconClass={profitIconClass}
            ariaLabel={`Lucro após comissão iFood de ${formatBRL(data.totalIfoodCommission)}`}
            subtitle={
              <span className="text-muted-foreground">
                Após comissão iFood:{' '}
                <span className="font-medium text-foreground">
                  {formatBRL(data.totalIfoodCommission)}
                </span>
              </span>
            }
          />
          <SummaryCard
            icon={Receipt}
            label="Ticket Médio"
            value={formatBRL(data.averageTicket)}
            iconContainerClass="bg-[hsl(215,25%,50%,0.15)]"
            iconClass="text-[hsl(215,25%,50%)]"
            subtitle={<span className="text-muted-foreground">Por venda no período</span>}
          />
          <SummaryCard
            icon={Store}
            label="Comissão iFood"
            value={formatBRL(data.totalIfoodCommission)}
            valueClassName="text-muted-foreground"
            iconContainerClass="bg-[hsl(30,80%,50%,0.15)]"
            iconClass="text-[hsl(30,80%,50%)]"
            ariaLabel={`Comissão iFood: ${formatBRL(data.totalIfoodCommission)}, ${data.ifoodSalesCount} venda(s) no iFood`}
            subtitle={
              data.totalIfoodCommission > 0 ? (
                <>
                  <span className="font-semibold text-foreground">{data.ifoodSalesCount}</span>{' '}
                  <span className="text-muted-foreground">venda(s) no iFood</span>
                </>
              ) : (
                <span className="text-muted-foreground">Sem vendas no iFood</span>
              )
            }
          />
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6" style={{ marginTop: '2rem' }}>
        <ChartCard title="Receitas vs Despesas">
          {loading ? (
            <ChartSkeleton />
          ) : data ? (
            <RevenueExpenseChart
              revenue={data.dailyRevenue}
              expenses={data.dailyExpenses}
              ifoodCommission={data.dailyIfoodCommission}
            />
          ) : null}
        </ChartCard>
        <ChartCard title="Formas de Pagamento">
          {loading ? (
            <DonutSkeleton />
          ) : data ? (
            <PaymentDonutChart breakdown={data.paymentBreakdown} />
          ) : null}
        </ChartCard>
      </div>

      {/* Top products */}
      <div style={{ marginTop: '2rem' }}>
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: '1rem' }}>
          <h2 className="text-foreground" style={{ fontSize: '1.125rem', fontWeight: 700 }}>
            Produtos Mais Vendidos
          </h2>
          <Button
            variant="outline"
            className="h-10 gap-2 px-4 text-[0.8125rem] font-medium hover:bg-muted/30 hover:border-ring/40 disabled:opacity-50"
            onClick={onExport}
            disabled={loading || !data || data.topProducts.length === 0}
            aria-label="Exportar relatório de produtos em CSV"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            className="h-10 gap-2 px-4 text-[0.8125rem] font-medium hover:bg-muted/30 hover:border-ring/40 focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-50"
            onClick={onExportPdf}
            disabled={loading || !data || (data.salesCount === 0 && data.purchasesCount === 0)}
            aria-label="Exportar relatório completo em PDF"
            title={
              !data || (data.salesCount === 0 && data.purchasesCount === 0)
                ? 'Gere um relatório com dados primeiro'
                : undefined
            }
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Exportar PDF
          </Button>
        </div>
        <div>
          {loading ? (
            <TopProductsSkeleton />
          ) : data && data.topProducts.length > 0 ? (
            <TopProductsTable products={data.topProducts} />
          ) : (
            <ProductsEmptyState />
          )}
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-4 rounded-[var(--radius)] border border-border bg-card"
      style={{ padding: '1.5rem' }}
    >
      <h3 className="text-foreground" style={{ fontSize: '1rem', fontWeight: 700 }}>
        {title}
      </h3>
      {children}
    </div>
  )
}
