import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useDashboard } from '@/hooks/useDashboard'
import { useStoreSettings } from '@/hooks/useStoreSettings'
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

function paymentBadgeClass(label: string): string {
  if (label === 'Cartão') {
    return 'bg-[hsl(215,25%,50%,0.15)] text-[hsl(215,25%,40%)] dark:text-[hsl(215,25%,70%)]'
  }
  if (label === 'Pix') {
    return 'bg-[hsl(265,70%,55%,0.15)] text-[hsl(265,70%,45%)] dark:text-[hsl(265,70%,70%)]'
  }
  return 'bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,35%)] dark:text-[hsl(142,70%,60%)]'
}

/** Channel badge shown next to the payment method in recent sales. */
function channelBadge(channel: string) {
  if (channel === 'iFood') {
    return {
      label: 'iFood',
      className: 'bg-[hsl(30,80%,50%,0.15)] text-[hsl(30,80%,40%)] dark:text-[hsl(30,80%,65%)]',
    }
  }
  return {
    label: 'PDV',
    className: 'bg-[hsl(215,70%,50%,0.12)] text-[hsl(215,70%,40%)] dark:text-[hsl(215,70%,65%)]',
  }
}

function formatDateBR(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

/**
 * Animated value — remounts on change to trigger a brief highlight flash that
 * fades out, signalling a realtime update.
 */
function AnimatedValue({
  value,
  className,
  highlightClass,
}: {
  value: string | number
  className?: string
  highlightClass?: string
}) {
  return (
    <span
      key={String(value)}
      className={`inline-block animate-flash-highlight ${className ?? ''}`}
      style={
        highlightClass
          ? ({
              ['--flash-color' as string]: highlightClass,
            } as React.CSSProperties)
          : undefined
      }
    >
      {value}
    </span>
  )
}

interface MetricCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  valueClassName?: string
  iconContainerClass: string
  iconClass: string
  subtitle: React.ReactNode
  ariaLabel?: string
}

function MetricCard({
  icon: Icon,
  label,
  value,
  valueClassName,
  iconContainerClass,
  iconClass,
  subtitle,
  ariaLabel,
}: MetricCardProps) {
  return (
    <article
      aria-label={ariaLabel ?? label}
      className="metric-card group relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius)] border border-border bg-card p-6"
    >
      <div
        className={`mb-1 flex h-10 w-10 items-center justify-center rounded-lg ${iconContainerClass}`}
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
        className={`mt-0.5 text-foreground tabular-nums ${valueClassName ?? ''}`}
        style={{ fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.2 }}
      >
        <AnimatedValue value={value} />
      </div>
      {subtitle && (
        <span
          className="mt-1 text-muted-foreground"
          style={{ fontSize: '0.75rem', lineHeight: 1.4 }}
        >
          {subtitle}
        </span>
      )}
    </article>
  )
}

function RecentSales({ sales }: { sales: Sale[] }) {
  const recent = [...sales].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5)

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Vendas Recentes</span>
      </div>
      {recent.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center px-4 py-6 text-center"
          style={{ padding: '1.5rem 1rem' }}
        >
          <ShoppingBag className="mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-muted-foreground" style={{ fontSize: '0.8125rem' }}>
            Nenhuma venda registrada ainda.
          </p>
        </div>
      ) : (
        <div className="p-2">
          {recent.map((s, idx) => {
            const label = paymentLabel(s.paymentMethod)
            const channel = channelBadge(s.salesChannel)
            return (
              <div
                key={s.id}
                className="flex items-center justify-between px-2 py-3"
                style={{
                  borderBottom:
                    idx === recent.length - 1 ? undefined : '1px solid hsl(var(--border) / 0.5)',
                }}
              >
                <span
                  className="text-muted-foreground tabular-nums"
                  style={{ fontSize: '0.8125rem' }}
                >
                  {formatDateBR(s.date)}
                </span>
                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className="font-semibold tabular-nums text-foreground"
                    style={{ fontSize: '0.875rem' }}
                  >
                    {formatBRL(s.total)}
                  </span>
                  <div className="flex items-center gap-1">
                    <span
                      className={`inline-flex items-center rounded-full ${paymentBadgeClass(label)}`}
                      style={{ padding: '0.125rem 0.5rem', fontSize: '0.6875rem', fontWeight: 500 }}
                    >
                      {label}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full ${channel.className}`}
                      style={{ padding: '0.125rem 0.5rem', fontSize: '0.6875rem', fontWeight: 500 }}
                    >
                      {channel.label}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RecentPurchases({
  purchases,
}: {
  purchases: { id: string; date: string; supplier: string | null; total: number }[]
}) {
  const recent = [...purchases].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Compras Recentes</span>
      </div>
      {recent.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center px-4 py-6 text-center"
          style={{ padding: '1.5rem 1rem' }}
        >
          <ShoppingCart className="mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-muted-foreground" style={{ fontSize: '0.8125rem' }}>
            Nenhuma compra registrada ainda.
          </p>
        </div>
      ) : (
        <div className="p-2">
          {recent.map((p, idx) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-2 py-3"
              style={{
                borderBottom:
                  idx === recent.length - 1 ? undefined : '1px solid hsl(var(--border) / 0.5)',
              }}
            >
              <span
                className="text-muted-foreground tabular-nums"
                style={{ fontSize: '0.8125rem' }}
              >
                {formatDateBR(p.date)}
              </span>
              <div className="flex flex-col items-end gap-0.5">
                <span
                  className="font-semibold tabular-nums text-foreground"
                  style={{ fontSize: '0.875rem' }}
                >
                  {formatBRL(p.total)}
                </span>
                <span
                  className="text-muted-foreground"
                  style={{
                    fontSize: '0.75rem',
                    fontStyle: p.supplier ? undefined : 'italic',
                  }}
                >
                  {p.supplier || 'Sem fornecedor'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
      className="mt-6 mb-0 flex items-start gap-2.5 rounded-[var(--radius)] p-4"
      style={{
        backgroundColor: 'hsl(var(--destructive) / 0.1)',
        border: '1px solid hsl(var(--destructive) / 0.3)',
        padding: '0.875rem 1rem',
      }}
      role="alert"
    >
      <AlertTriangle
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive"
        style={{ marginTop: '0.125rem' }}
      />
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold text-foreground" style={{ fontSize: '0.875rem' }}>
          Atenção: {ingredients.length} insumo(s) com estoque baixo.
        </p>
        <p className="text-muted-foreground" style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
          {names}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:bg-[hsl(var(--destructive)/0.15)] hover:text-foreground"
        onClick={onDismiss}
        aria-label="Dispensar alerta de estoque"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

function MetricCardSkeleton() {
  return (
    <div
      className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-6"
      style={{ gap: '0.5rem' }}
    >
      <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-2">
        <h2 className="text-lg font-bold text-foreground" style={{ fontSize: '1.125rem' }}>
          Atividade Recente
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          {[0, 1].map((col) => (
            <div
              key={col}
              className="overflow-hidden rounded-[var(--radius)] border border-border bg-card"
            >
              <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
                <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              </div>
              <div className="p-2">
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className="flex items-center justify-between px-2 py-3"
                    style={{
                      borderBottom: row === 2 ? undefined : '1px solid hsl(var(--border) / 0.5)',
                    }}
                  >
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WelcomeState({ storeName }: { storeName: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '3rem 1.5rem' }}
    >
      <Store className="h-16 w-16 text-muted-foreground" />
      <h2
        className="text-foreground"
        style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1rem' }}
      >
        Bem-vindo ao {storeName}!
      </h2>
      <p
        className="text-muted-foreground"
        style={{ fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: 400 }}
      >
        Comece cadastrando seus produtos e insumos para acompanhar seu negócio.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row" style={{ gap: '0.75rem' }}>
        <Button asChild className="h-11 px-6">
          <Link to="/products">Cadastrar Produtos</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 px-6">
          <Link to="/purchases">Cadastrar Insumos</Link>
        </Button>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '3rem 1.5rem' }}
    >
      <AlertCircle className="h-12 w-12 text-destructive" style={{ marginBottom: '1rem' }} />
      <h2 className="text-foreground" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
        Erro ao carregar dados
      </h2>
      <p className="text-muted-foreground" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
        {message || 'Não foi possível carregar o resumo do seu negócio.'}
      </p>
      <Button
        variant="outline"
        className="mt-4 h-11 px-5"
        onClick={onRetry}
        aria-label="Tentar novamente"
      >
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  )
}

export default function DashboardPage() {
  const { metrics, sales, purchases, loading, error, refetch } = useDashboard()
  const { settings, loading: settingsLoading } = useStoreSettings()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const storeName =
    settingsLoading && !settings.id ? 'Minha Loja' : settings.storeName || 'Minha Loja'

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

  const profitColor =
    metrics.totalProfit > 0
      ? 'text-[hsl(142,70%,35%)] dark:text-[hsl(142,70%,55%)]'
      : metrics.totalProfit < 0
        ? 'text-destructive'
        : 'text-foreground'

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
              <WelcomeState storeName={storeName} />
            ) : (
              <div
                className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
                style={{ marginTop: '1.5rem' }}
              >
                <MetricCard
                  icon={TrendingUp}
                  label="Lucro Liquido"
                  value={formatBRL(metrics.totalProfit)}
                  valueClassName={profitColor}
                  iconContainerClass="bg-[hsl(142,70%,45%,0.15)]"
                  iconClass="text-[hsl(142,70%,45%)]"
                  subtitle={
                    <>
                      <span className="text-muted-foreground">Receitas:</span>{' '}
                      <span className="text-foreground">{formatBRL(metrics.totalRevenue)}</span> |{' '}
                      <span className="text-muted-foreground">Despesas:</span>{' '}
                      <span className="text-foreground">{formatBRL(metrics.totalExpenses)}</span> |{' '}
                      <span className="text-muted-foreground">Comissão iFood:</span>{' '}
                      <span className="text-foreground">
                        {formatBRL(metrics.totalIfoodCommission)}
                      </span>
                    </>
                  }
                />
                <MetricCard
                  icon={ShoppingBag}
                  label="Vendas de Hoje"
                  value={formatBRL(metrics.todaySales)}
                  iconContainerClass="bg-[hsl(var(--primary)/0.15)]"
                  iconClass="text-primary"
                  subtitle={
                    <>
                      <span className="font-semibold text-foreground">
                        {metrics.todaySalesCount}
                      </span>{' '}
                      <span className="text-muted-foreground">venda(s) hoje</span>
                    </>
                  }
                />
                <MetricCard
                  icon={TrendingDown}
                  label="Despesas do Mês"
                  value={formatBRL(metrics.monthExpenses)}
                  iconContainerClass="bg-[hsl(var(--destructive)/0.15)]"
                  iconClass="text-destructive"
                  subtitle={
                    <>
                      <span className="font-medium text-foreground">{monthName}</span>
                      <span className="text-muted-foreground"> — </span>
                      <span className="font-semibold text-foreground">
                        {metrics.monthExpensesCount}
                      </span>{' '}
                      <span className="text-muted-foreground">compra(s)</span>
                    </>
                  }
                />
                <MetricCard
                  icon={Store}
                  label="Comissão iFood"
                  value={formatBRL(metrics.totalIfoodCommission)}
                  valueClassName={
                    metrics.totalIfoodCommission > 0 ? 'text-destructive' : 'text-muted-foreground'
                  }
                  iconContainerClass="bg-[hsl(30,80%,50%,0.15)]"
                  iconClass="text-[hsl(30,80%,50%)]"
                  subtitle={
                    metrics.totalIfoodCommission > 0 ? (
                      <>
                        <span className="font-semibold text-foreground">
                          {metrics.ifoodSalesCount}
                        </span>{' '}
                        <span className="text-muted-foreground">venda(s) no iFood</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Sem vendas no iFood</span>
                    )
                  }
                />
              </div>
            )}

            <div className="mt-8" style={{ marginTop: '2rem' }}>
              <h2 className="text-foreground" style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                Atividade Recente
              </h2>
              <div
                className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6"
                style={{ marginTop: '1rem' }}
              >
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
