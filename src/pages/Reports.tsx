import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  Download,
  FileText,
  Filter,
  Loader2,
  Receipt,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useReports } from '@/hooks/useReports'
import { formatBRL, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DailyPoint, PaymentBreakdown, ReportData, TopProduct } from '@/types'

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
function buildBarChartHtml(dailyRevenue: DailyPoint[], dailyExpenses: DailyPoint[]): string {
  const hasData = dailyRevenue.some((p) => p.value > 0) || dailyExpenses.some((p) => p.value > 0)

  if (!hasData) {
    return '<div style="text-align:center;padding:12px;color:#777777;font-size:11px;">Sem dados de receitas e despesas no período.</div>'
  }

  const max = Math.max(0, ...dailyRevenue.map((p) => p.value), ...dailyExpenses.map((p) => p.value))
  const maxSafe = max > 0 ? max : 1

  let points = dailyRevenue.map((rev, i) => ({
    label: rev.date,
    revenue: rev.value,
    expenses: dailyExpenses[i]?.value ?? 0,
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
      return `
      <div style="display:flex;align-items:center;margin-bottom:6px;">
        <div style="width:50px;font-size:9px;color:#555555;flex-shrink:0;">${escapeHtml(p.label)}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;margin-bottom:2px;">
            <div style="height:10px;background-color:#006600;width:${revW}px;border-radius:2px;"></div>
            ${p.revenue > 0 ? `<span style="font-size:9px;color:#333333;margin-left:4px;">${brl(p.revenue)}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;">
            <div style="height:10px;background-color:#990000;width:${expW}px;border-radius:2px;"></div>
            ${p.expenses > 0 ? `<span style="font-size:9px;color:#333333;margin-left:4px;">${brl(p.expenses)}</span>` : ''}
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
      </div>
    </div>`
}

/** Build the full self-contained HTML document for the printable report. */
function buildReportHtml(data: ReportData, start: string, end: string): string {
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

  const chartHtml = buildBarChartHtml(data.dailyRevenue, data.dailyExpenses)

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
<title>Relatório Financeiro — Assados Control</title>
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
    <div style="font-size:20px;font-weight:700;text-align:center;margin-bottom:4px;">Assados Control</div>
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
          <th>Lucro</th>
          <th>Ticket Médio</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px 10px;text-align:center;font-size:14px;font-weight:700;color:#006600;">${brl(data.totalRevenue)}</td>
          <td style="padding:8px 10px;text-align:center;font-size:14px;font-weight:700;color:#990000;">${brl(data.totalExpenses)}</td>
          <td style="padding:8px 10px;text-align:center;font-size:14px;font-weight:700;color:${profitColor};">${brl(data.totalProfit)}</td>
          <td style="padding:8px 10px;text-align:center;font-size:14px;font-weight:700;color:#333333;">${brl(data.averageTicket)}</td>
        </tr>
      </tbody>
    </table>
    <div style="font-size:10px;color:#777777;margin-top:4px;">Total de vendas: ${data.salesCount} | Total de compras: ${data.purchasesCount}</div>
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
      <span style="font-size:9px;color:#999999;">Assados Control - Sistema de Gestão</span>
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

function exportReportPdf(data: ReportData, start: string, end: string): boolean {
  const html = buildReportHtml(data, start, end)
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
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  valueClassName,
  iconContainerClass,
  iconClass,
  subtitle,
}: SummaryCardProps) {
  return (
    <article
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
}

function RevenueExpenseChart({ revenue, expenses }: BarChartProps) {
  const hasData = revenue.some((p) => p.value > 0) || expenses.some((p) => p.value > 0)
  const max = useMemo(() => {
    const m = Math.max(0, ...revenue.map((p) => p.value), ...expenses.map((p) => p.value))
    return m > 0 ? m : 1
  }, [revenue, expenses])

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
        aria-label="Gráfico de receitas versus despesas por período"
      >
        {revenue.map((point, i) => {
          const exp = expenses[i]?.value ?? 0
          const revH = Math.max((point.value / max) * 100, point.value > 0 ? 4 / 2.8 : 0)
          const expH = Math.max((exp / max) * 100, exp > 0 ? 4 / 2.8 : 0)
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
                    className="w-2 rounded-t sm:w-3"
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
                    className="w-2 rounded-t sm:w-3"
                    style={{
                      height: `${expH}%`,
                      backgroundColor: 'var(--destructive)',
                      minHeight: exp > 0 ? 4 : 0,
                    }}
                    title={`Despesas: ${formatBRL(exp)}`}
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
      <div className="flex items-center gap-4" style={{ marginTop: '0.75rem' }}>
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
      </div>
      {/* Visually hidden summary table for screen readers */}
      <table className="sr-only">
        <caption>Receitas e despesas por período</caption>
        <thead>
          <tr>
            <th>Período</th>
            <th>Receitas</th>
            <th>Despesas</th>
          </tr>
        </thead>
        <tbody>
          {revenue.map((p, i) => (
            <tr key={i}>
              <td>{p.date}</td>
              <td>{formatBRL(p.value)}</td>
              <td>{formatBRL(expenses[i]?.value ?? 0)}</td>
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
              className="w-2 animate-pulse rounded-t bg-muted sm:w-3"
              style={{ height: `${h}%`, minHeight: 4 }}
            />
            <div
              className="w-2 animate-pulse rounded-t bg-muted sm:w-3"
              style={{ height: `${h * 0.6}%`, minHeight: 4 }}
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
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ReportsPage() {
  const { reportData, loading, error, refresh } = useReports()
  const { toast } = useToast()

  const [startInput, setStartInput] = useState<string>(firstDayOfMonthYMD())
  const [endInput, setEndInput] = useState<string>(todayYMD())
  const [activeStart, setActiveStart] = useState<string>(firstDayOfMonthYMD())
  const [activeEnd, setActiveEnd] = useState<string>(todayYMD())
  const [hasGenerated, setHasGenerated] = useState(false)

  const invalidRange = startInput > endInput

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
    const ok = exportReportPdf(reportData, activeStart, activeEnd)
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

  return (
    <section>
      <PageHeader title="Relatórios" subtitle="Análise financeira e desempenho do seu negócio" />

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
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Loading + body composites                                           */
/* ------------------------------------------------------------------ */

function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SummaryCardSkeleton key={i} />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
            subtitle={
              <span className="text-muted-foreground">
                Ticket médio:{' '}
                <span className="font-medium text-foreground">{formatBRL(data.averageTicket)}</span>
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
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6" style={{ marginTop: '2rem' }}>
        <ChartCard title="Receitas vs Despesas">
          {loading ? (
            <ChartSkeleton />
          ) : data ? (
            <RevenueExpenseChart revenue={data.dailyRevenue} expenses={data.dailyExpenses} />
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
