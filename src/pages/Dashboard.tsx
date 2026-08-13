import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  Package,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDashboard } from '@/hooks/useDashboard'
import { formatBRL, formatNumber } from '@/lib/format'
import type { Sale } from '@/types'

const MONTHS_PT_BR = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function paymentLabel(method: string): string {
  const m = method?.toLowerCase()
  if (m === 'cartao' || m === 'card') return 'Cartão'
  if (m === 'pix') return 'Pix'
  return 'Dinheiro'
}

function formatDateBR(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

/** Animated value — remounts on change to trigger the fade-in animation. */
function AnimatedValue({ value, className }: { value: string | number; className?: string }) {
  return (
    <span key={String(value)} className={`animate-in fade-in-0 ${className ?? ''}`}>
      {value}
    </span>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  valueClassName,
  subtitle,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  valueClassName?: string
  subtitle: string
}) {
  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`text-2xl font-bold tabular-nums ${valueClassName ?? 'text-foreground'}`}>
          <AnimatedValue value={value} />
        </div>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
    </article>
  )
}

function RecentSales({ sales }: { sales: Sale[] }) {
  const recent = [...sales].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5)

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <ShoppingBag className="h-5 w-5" />
        Vendas Recentes
      </h3>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
        </div>
      ) : (
        <div>
          {recent.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between border-b border-border px-3 py-3 last:border-b-0"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm">{formatDateBR(s.date)}</span>
                <Badge variant="outline" className="w-fit text-xs">
                  {paymentLabel(s.paymentMethod)}
                </Badge>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatBRL(s.total)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function RecentPurchases({
  purchases,
}: {
  purchases: { id: string; date: string; supplier: string | null; total: number }[]
}) {
  const recent = [...purchases].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <ShoppingCart className="h-5 w-5" />
        Compras Recentes
      </h3>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <ShoppingCart className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma compra registrada ainda.</p>
        </div>
      ) : (
        <div>
          {recent.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-b border-border px-3 py-3 last:border-b-0"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm">{formatDateBR(p.date)}</span>
                <span className="text-xs text-muted-foreground">
                  {p.supplier || 'Sem fornecedor'}
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatBRL(p.total)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function LowStockBanner({
  ingredients,
  onDismiss,
}: {
  ingredients: { id: string; name: string; currentStock: number; minStock: number; unit: string }[]
  onDismiss: () => void
}) {
  if (ingredients.length === 0) return null

  const names = ingredients
    .map(
      (i) =>
        `${i.name} (${formatNumber(i.currentStock)} ${i.unit} de ${formatNumber(i.minStock)} ${i.unit})`,
    )
    .join(', ')

  return (
    <div
      className="mb-6 flex items-start gap-2.5 rounded-[var(--radius)] p-3 px-4"
      style={{
        backgroundColor: 'hsl(var(--destructive) / 0.1)',
        border: '1px solid hsl(var(--destructive) / 0.3)',
      }}
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
      <div className="flex-1">
        <p className="text-sm font-semibold">
          Atenção: {ingredients.length} insumo(s) com estoque baixo.
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{names}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0"
        onClick={onDismiss}
        aria-label="Fechar alerta"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 w-full animate-pulse rounded-[var(--radius)] bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function WelcomeState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Store className="h-16 w-16 text-muted-foreground" />
      <h2 className="mt-4 text-2xl font-bold">Bem-vindo ao Assados Control!</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Comece cadastrando seus produtos e insumos para acompanhar seu negócio.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link to="/products">Cadastrar Produtos</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/purchases">Cadastrar Insumos</Link>
        </Button>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold">Erro ao carregar dados</h2>
      <p className="mt-2 max-w-[320px] text-sm text-muted-foreground">
        {message || 'Não foi possível carregar o resumo do seu negócio.'}
      </p>
      <Button variant="outline" className="mt-6 h-11" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}

export default function DashboardPage() {
  const { metrics, sales, purchases, loading, error, refetch } = useDashboard()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const now = new Date()
  const monthName = `${MONTHS_PT_BR[now.getMonth()]} de ${now.getFullYear()}`

  const showBanner =
    !loading && !error && !bannerDismissed && metrics.lowStockIngredients.length > 0

  const isEmpty =
    !loading &&
    !error &&
    metrics.totalRevenue === 0 &&
    metrics.totalExpenses === 0 &&
    metrics.todaySalesCount === 0 &&
    metrics.totalProducts === 0

  return (
    <section>
      <PageHeader title="Dashboard" subtitle="Resumo financeiro do seu negócio" />

      <div className="mt-6">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <>
            {showBanner && (
              <LowStockBanner
                ingredients={metrics.lowStockIngredients}
                onDismiss={() => setBannerDismissed(true)}
              />
            )}

            {isEmpty ? (
              <WelcomeState />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  icon={TrendingUp}
                  label="Lucro Total"
                  value={formatBRL(metrics.totalProfit)}
                  valueClassName={
                    metrics.totalProfit > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : metrics.totalProfit < 0
                        ? 'text-destructive'
                        : 'text-foreground'
                  }
                  subtitle={`Receitas: ${formatBRL(metrics.totalRevenue)} | Despesas: ${formatBRL(metrics.totalExpenses)}`}
                />
                <MetricCard
                  icon={ShoppingBag}
                  label="Vendas de Hoje"
                  value={formatBRL(metrics.todaySales)}
                  subtitle={`${metrics.todaySalesCount} venda(s) hoje`}
                />
                <MetricCard
                  icon={TrendingDown}
                  label="Despesas do Mês"
                  value={formatBRL(metrics.monthExpenses)}
                  subtitle={`${monthName} • ${metrics.monthExpensesCount} compra(s)`}
                />
                <MetricCard
                  icon={Package}
                  label="Produtos Ativos"
                  value={metrics.activeProducts}
                  subtitle={`${metrics.totalProducts} total cadastrado(s)`}
                />
              </div>
            )}

            <div className="mt-8">
              <h2 className="mb-4 text-lg font-semibold">Atividade Recente</h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <RecentSales sales={sales} />
                <RecentPurchases purchases={purchases} />
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
