import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  Download,
  Filter,
  Loader2,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useReports } from '@/hooks/useReports'
import { formatBRL, formatNumber } from '@/lib/format'
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
      className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card"
      style={{ padding: '1.5rem' }}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconContainerClass}`}
      >
        <Icon className={`h-5 w-5 ${iconClass}`} />
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
        className={`tabular-nums text-foreground ${valueClassName ?? ''}`}
        style={{ fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.2 }}
      >
        {value}
      </div>
      {subtitle && (
        <span className="text-muted-foreground" style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
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
      <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
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
        className="flex items-center justify-center text-center text-muted-foreground"
        style={{ minHeight: 240 }}
      >
        Sem dados para o período selecionado.
      </div>
    )
  }

  return (
    <div>
      <div
        className="flex items-end gap-1 sm:gap-2"
        style={{ height: 240, overflowX: 'auto', paddingBottom: '0.25rem' }}
        role="img"
        aria-label="Gráfico de receitas versus despesas por período"
      >
        {revenue.map((point, i) => {
          const exp = expenses[i]?.value ?? 0
          const revH = Math.max((point.value / max) * 100, point.value > 0 ? 2 : 0)
          const expH = Math.max((exp / max) * 100, exp > 0 ? 2 : 0)
          return (
            <div
              key={i}
              className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-1"
              style={{ height: '100%' }}
            >
              <div
                className="flex w-full flex-1 items-end justify-center gap-0.5"
                style={{ minWidth: 0 }}
              >
                <div
                  className="w-1/2 max-w-[1.25rem] rounded-t"
                  style={{
                    height: `${revH}%`,
                    backgroundColor: 'hsl(142 70% 45%)',
                    minHeight: point.value > 0 ? '2px' : 0,
                  }}
                  title={`Receitas: ${formatBRL(point.value)}`}
                />
                <div
                  className="w-1/2 max-w-[1.25rem] rounded-t"
                  style={{
                    height: `${expH}%`,
                    backgroundColor: 'hsl(0 70% 50%)',
                    minHeight: exp > 0 ? '2px' : 0,
                  }}
                  title={`Despesas: ${formatBRL(exp)}`}
                />
              </div>
              <span
                className="text-muted-foreground"
                style={{ fontSize: '0.625rem', lineHeight: 1, whiteSpace: 'nowrap' }}
              >
                {point.date}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4">
        <span
          className="flex items-center gap-1.5 text-muted-foreground"
          style={{ fontSize: '0.75rem' }}
        >
          <span
            className="inline-block rounded"
            style={{ width: 10, height: 10, backgroundColor: 'hsl(142 70% 45%)' }}
          />
          Receitas
        </span>
        <span
          className="flex items-center gap-1.5 text-muted-foreground"
          style={{ fontSize: '0.75rem' }}
        >
          <span
            className="inline-block rounded"
            style={{ width: 10, height: 10, backgroundColor: 'hsl(0 70% 50%)' }}
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
    <div className="flex items-end gap-2" style={{ height: 240 }} aria-hidden="true">
      {[40, 65, 30, 80, 50, 20, 70].map((h, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1" style={{ height: '100%' }}>
          <div className="flex w-full flex-1 items-end justify-center gap-0.5">
            <div
              className="h-1/2 w-1/2 max-w-[1.25rem] animate-pulse rounded-t bg-muted"
              style={{ height: `${h}%` }}
            />
            <div
              className="h-1/3 w-1/2 max-w-[1.25rem] animate-pulse rounded-t bg-muted"
              style={{ height: `${h * 0.6}%` }}
            />
          </div>
          <div className="h-2 w-8 animate-pulse rounded bg-muted" />
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

  const radius = 70
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const segments = PAYMENT_META.map((meta) => {
    const value = breakdown[meta.key]
    const fraction = total > 0 ? value / total : 0
    const dash = fraction * circumference
    const seg = {
      color: meta.color,
      dash,
      gap: circumference - dash,
      offset: -offset,
      label: meta.label,
      value,
      fraction,
    }
    offset += dash
    return seg
  })

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: 180, height: 180 }}>
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          role="img"
          aria-label="Formas de pagamento"
        >
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="20"
          />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="20"
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={seg.offset}
              transform="rotate(-90 90 90)"
            />
          ))}
          <text
            x="90"
            y="84"
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: '0.625rem' }}
          >
            Total
          </text>
          <text
            x="90"
            y="102"
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: '0.875rem', fontWeight: 700 }}
          >
            {formatBRL(total)}
          </text>
        </svg>
      </div>
      <div className="flex w-full flex-col gap-2">
        {PAYMENT_META.map((meta) => (
          <div key={meta.key} className="flex items-center justify-between gap-2">
            <span
              className="flex items-center gap-2 text-muted-foreground"
              style={{ fontSize: '0.8125rem' }}
            >
              <span
                className="inline-block rounded-full"
                style={{ width: 10, height: 10, backgroundColor: meta.color }}
              />
              {meta.label}
            </span>
            <span
              className="tabular-nums text-foreground"
              style={{ fontSize: '0.8125rem', fontWeight: 600 }}
            >
              {formatBRL(breakdown[meta.key])}{' '}
              <span className="text-muted-foreground" style={{ fontWeight: 400 }}>
                ({formatPercent(breakdown[meta.key], total)})
              </span>
            </span>
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
      <div className="animate-pulse rounded-full bg-muted" style={{ width: 180, height: 180 }} />
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
            <tr className="border-b border-border">
              <th
                className="text-left text-muted-foreground"
                style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', fontWeight: 600 }}
              >
                Posição
              </th>
              <th
                className="text-left text-muted-foreground"
                style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', fontWeight: 600 }}
              >
                Produto
              </th>
              <th
                className="text-right text-muted-foreground"
                style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', fontWeight: 600 }}
              >
                Quantidade Vendida
              </th>
              <th
                className="text-right text-muted-foreground"
                style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', fontWeight: 600 }}
              >
                Receita Gerada
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => (
              <tr
                key={`${p.productName}-${idx}`}
                style={{
                  backgroundColor: idx % 2 === 1 ? 'hsl(var(--muted) / 0.3)' : 'var(--card)',
                }}
              >
                <td
                  className="text-foreground tabular-nums"
                  style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  {idx + 1}
                </td>
                <td
                  className="text-foreground"
                  style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}
                >
                  {p.productName}
                </td>
                <td
                  className="text-right text-foreground tabular-nums"
                  style={{
                    padding: '0.875rem 1rem',
                    fontSize: '0.875rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatNumber(p.quantitySold)}
                </td>
                <td
                  className="text-right text-foreground tabular-nums"
                  style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 700 }}
                >
                  {formatBRL(p.totalRevenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {products.map((p, idx) => (
          <div
            key={`${p.productName}-${idx}`}
            className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card"
            style={{ padding: '0.875rem 1rem' }}
          >
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white"
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                backgroundColor:
                  idx === 0
                    ? 'hsl(43 96% 56%)'
                    : idx === 1
                      ? 'hsl(215 25% 50%)'
                      : idx === 2
                        ? 'hsl(25 80% 50%)'
                        : 'hsl(142 70% 45%)',
              }}
            >
              {idx + 1}
            </span>
            <div className="flex flex-1 flex-col gap-0.5" style={{ minWidth: 0 }}>
              <span className="text-foreground" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                {p.productName}
              </span>
              <span className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                {formatNumber(p.quantitySold)} un. · {formatBRL(p.totalRevenue)}
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
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card"
          style={{ padding: '0.875rem 1rem' }}
        >
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-1">
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Empty / error states                                                */
/* ------------------------------------------------------------------ */

function EmptyPeriodState({ start, end }: { start: string; end: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '3rem 1.5rem' }}
    >
      <BarChart3 className="h-16 w-16 text-muted-foreground" />
      <h2
        className="text-foreground"
        style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1rem' }}
      >
        Sem dados no período
      </h2>
      <p className="text-muted-foreground" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
        Não há vendas ou compras registradas entre {formatBR(start)} e {formatBR(end)}.
      </p>
      <p className="text-muted-foreground" style={{ fontSize: '0.8125rem', marginTop: '0.75rem' }}>
        Tente selecionar um período diferente.
      </p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '3rem 1.5rem' }}
    >
      <AlertCircle className="h-12 w-12 text-destructive" style={{ marginBottom: '1rem' }} />
      <h2 className="text-foreground" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
        Erro ao gerar relatório
      </h2>
      <p className="text-muted-foreground" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
        Não foi possível carregar os dados do período selecionado.
      </p>
      <Button
        variant="outline"
        className="mt-4 h-11 px-5"
        onClick={onRetry}
        aria-label="Tentar novamente"
      >
        Tentar novamente
      </Button>
    </div>
  )
}

function ProductsEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '2.5rem 1.5rem' }}
    >
      <BarChart3 className="h-12 w-12 text-muted-foreground" style={{ marginBottom: '0.75rem' }} />
      <h3 className="text-foreground" style={{ fontSize: '1rem', fontWeight: 600 }}>
        Nenhum produto vendido no período
      </h3>
      <p className="text-muted-foreground" style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
        Não há vendas registradas no período selecionado.
      </p>
    </div>
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
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        style={{ marginTop: '1.5rem', marginBottom: '1.5rem', gap: '0.75rem' }}
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="report-start"
            className="text-muted-foreground"
            style={{ fontSize: '0.75rem', fontWeight: 500 }}
          >
            De
          </label>
          <input
            id="report-start"
            type="date"
            required
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            className="h-11 rounded-[var(--radius)] border border-border bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ fontSize: '0.875rem' }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="report-end"
            className="text-muted-foreground"
            style={{ fontSize: '0.75rem', fontWeight: 500 }}
          >
            Até
          </label>
          <input
            id="report-end"
            type="date"
            required
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            className="h-11 rounded-[var(--radius)] border border-border bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ fontSize: '0.875rem' }}
          />
        </div>
        <div className="flex flex-col gap-1 sm:self-end">
          <Button className="h-11 px-5" onClick={handleGenerate} disabled={loading || invalidRange}>
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
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: '1.5rem' }}>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => handlePreset('hoje')}
          disabled={loading}
        >
          Hoje
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => handlePreset('7dias')}
          disabled={loading}
        >
          7 Dias
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => handlePreset('mes')}
          disabled={loading}
        >
          Este Mês
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => handlePreset('30dias')}
          disabled={loading}
        >
          30 Dias
        </Button>
      </div>

      {invalidRange && (
        <p
          className="text-destructive"
          style={{ marginBottom: '1.5rem', fontSize: '0.8125rem' }}
          role="alert"
        >
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" style={{ marginTop: '2rem' }}>
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
        <div className="mt-4">
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
}

function ReportsBody({ data, loading, profitColor, onExport }: ReportsBodyProps) {
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
            iconContainerClass="bg-[hsl(var(--primary)/0.15)]"
            iconClass="text-primary"
            subtitle={
              <span className="text-muted-foreground">
                Ticket médio:{' '}
                <span className="text-foreground">{formatBRL(data.averageTicket)}</span>
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" style={{ marginTop: '2rem' }}>
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-foreground" style={{ fontSize: '1.125rem', fontWeight: 700 }}>
            Produtos Mais Vendidos
          </h2>
          <Button
            variant="outline"
            className="h-11"
            onClick={onExport}
            disabled={loading || !data || data.topProducts.length === 0}
            aria-label="Exportar relatório de produtos em CSV"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
        <div className="mt-4">
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
      className="rounded-[var(--radius)] border border-border bg-card"
      style={{ padding: '1.25rem' }}
    >
      <h3
        className="text-foreground"
        style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}
