import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  PackageSearch,
  ShoppingCart,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/PageHeader'
import { SaleDetailSheet } from '@/components/sales/SaleDetailSheet'
import { useSales } from '@/hooks/useSales'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SaleListItem } from '@/types'

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'Pix',
}

const PAYMENT_DOT_COLORS: Record<string, string> = {
  dinheiro: 'hsl(142 70% 45%)',
  cartao: 'hsl(217 91% 60%)',
  pix: 'hsl(271 76% 53%)',
}

/** Format an ISO date string as DD/MM/YYYY HH:mm (UTC, to match stored values). */
function formatDateTime(iso: string | Date): string {
  const s = typeof iso === 'string' ? iso : iso.toISOString()
  if (!s) return '—'
  const d = new Date(s.endsWith('Z') ? s : s + 'Z')
  if (Number.isNaN(d.getTime())) return String(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function netValue(sale: SaleListItem): number {
  return sale.total - (sale.ifoodCommission ?? 0)
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === 'iFood') {
    return (
      <Badge
        variant="outline"
        className="inline-flex items-center gap-1 rounded-full border-transparent px-2.5 py-1 text-xs font-medium"
        style={{ backgroundColor: 'hsl(24 90% 50% / 0.15)', color: 'hsl(24 90% 40%)' }}
      >
        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: 'hsl(24 90% 50%)' }} />
        iFood
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="inline-flex items-center gap-1 rounded-full border-transparent px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: 'hsl(217 91% 60% / 0.15)', color: 'hsl(217 91% 45%)' }}
    >
      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: 'hsl(217 91% 60%)' }} />
      PDV
    </Badge>
  )
}

function PaymentLabel({ method }: { method: string }) {
  const color = PAYMENT_DOT_COLORS[method] ?? 'hsl(220 9% 46%)'
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {PAYMENT_LABELS[method] ?? method}
    </span>
  )
}

export default function SalesPage() {
  const [page, setPage] = useState(1)
  const [channel, setChannel] = useState('all')
  const [payment, setPayment] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null)

  const filtersActive = channel !== 'all' || payment !== 'all' || startDate !== '' || endDate !== ''

  const { sales, totalCount, totalPages, currentPage, loading, error, refresh } = useSales({
    page,
    pageSize: 20,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    channelFilter: channel,
    paymentFilter: payment,
  })

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1)
  }, [channel, payment, startDate, endDate])

  function clearFilters() {
    setChannel('all')
    setPayment('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  function openDetail(saleId: string) {
    setDetailSaleId(saleId)
    setDetailOpen(true)
  }

  return (
    <section>
      <PageHeader title="Vendas" subtitle="Histórico de vendas do PDV e iFood" />

      {/* Filter bar */}
      <div
        className="flex flex-col items-stretch gap-3 md:flex-row md:items-center"
        style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}
      >
        <Select value={channel} onValueChange={setChannel} disabled={loading}>
          <SelectTrigger
            className="h-11 w-full rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20 md:w-[200px]"
            aria-label="Filtrar por canal"
          >
            <SelectValue placeholder="Todos os canais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            <SelectItem value="PDV">PDV</SelectItem>
            <SelectItem value="iFood">iFood</SelectItem>
          </SelectContent>
        </Select>

        <Select value={payment} onValueChange={setPayment} disabled={loading}>
          <SelectTrigger
            className="h-11 w-full rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20 md:w-[200px]"
            aria-label="Filtrar por forma de pagamento"
          >
            <SelectValue placeholder="Todos os pagamentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os pagamentos</SelectItem>
            <SelectItem value="dinheiro">Dinheiro</SelectItem>
            <SelectItem value="cartao">Cartão</SelectItem>
            <SelectItem value="pix">Pix</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="sales-start-date" className="text-xs font-medium text-muted-foreground">
              De
            </label>
            <Input
              id="sales-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={loading}
              className="h-11 rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="sales-end-date" className="text-xs font-medium text-muted-foreground">
              Até
            </label>
            <Input
              id="sales-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={loading}
              className="h-11 rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
            />
          </div>
        </div>

        {filtersActive && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            disabled={loading}
            className="h-11 px-4 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Body */}
      <div>
        {loading ? (
          <SalesTableSkeleton />
        ) : error ? (
          <ErrorState onRetry={refresh} />
        ) : sales.length === 0 ? (
          <EmptyState hasFilters={filtersActive} onClear={clearFilters} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow className="h-12 bg-muted hover:bg-muted">
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Data/Hora
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Canal
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Itens
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Forma de Pagamento
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Valor Total
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Comissão iFood
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Taxa de Entrega
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Valor Líquido
                    </TableHead>
                    <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => {
                    const net = netValue(sale)
                    return (
                      <TableRow
                        key={sale.id}
                        className="h-16 border-t border-border text-sm text-card-foreground transition-colors duration-150 hover:bg-muted/50"
                      >
                        <TableCell
                          className="tabular-nums px-4 align-middle"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatDateTime(sale.date)}
                        </TableCell>
                        <TableCell className="px-4 align-middle">
                          <ChannelBadge channel={sale.salesChannel} />
                        </TableCell>
                        <TableCell className="px-4 align-middle text-muted-foreground">—</TableCell>
                        <TableCell className="px-4 align-middle">
                          <PaymentLabel method={sale.paymentMethod} />
                        </TableCell>
                        <TableCell className="tabular-nums px-4 align-middle font-semibold">
                          {formatBRL(sale.total)}
                        </TableCell>
                        <TableCell className="tabular-nums px-4 align-middle text-muted-foreground">
                          {sale.ifoodCommission ? (
                            formatBRL(sale.ifoodCommission)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums px-4 align-middle text-muted-foreground">
                          {sale.deliveryFee > 0 ? (
                            formatBRL(sale.deliveryFee)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 align-middle">
                          <span
                            className={cn(
                              'tabular-nums font-bold',
                              net >= 0 ? 'text-green-600' : 'text-red-600',
                            )}
                          >
                            {formatBRL(net)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 align-middle">
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              className="h-9 gap-1 px-3 text-sm text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label="Ver detalhes da venda"
                              onClick={() => openDetail(sale.id)}
                            >
                              Ver detalhes
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-3 md:hidden">
              {sales.map((sale) => {
                const net = netValue(sale)
                return (
                  <div
                    key={sale.id}
                    className="flex animate-in fade-in-0 flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <p
                          className="tabular-nums text-[0.9375rem] font-semibold text-foreground"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatDateTime(sale.date)}
                        </p>
                        <ChannelBadge channel={sale.salesChannel} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="tabular-nums font-semibold text-foreground">
                          {formatBRL(sale.total)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Comissão</p>
                        <p className="tabular-nums text-foreground">
                          {sale.ifoodCommission ? formatBRL(sale.ifoodCommission) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Taxa de Entrega</p>
                        <p className="tabular-nums text-foreground">
                          {sale.deliveryFee > 0 ? formatBRL(sale.deliveryFee) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Valor Líquido</p>
                        <p
                          className={cn(
                            'tabular-nums font-bold',
                            net >= 0 ? 'text-green-600' : 'text-red-600',
                          )}
                        >
                          {formatBRL(net)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pagamento</p>
                        <PaymentLabel method={sale.paymentMethod} />
                      </div>
                      <div>
                        <p className="text-muted-foreground">Itens</p>
                        <p className="text-muted-foreground">—</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="h-11 w-full"
                      aria-label="Ver detalhes da venda"
                      onClick={() => openDetail(sale.id)}
                    >
                      Ver detalhes
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              shownCount={sales.length}
              totalCount={totalCount}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <SaleDetailSheet open={detailOpen} onOpenChange={setDetailOpen} saleId={detailSaleId} />
    </section>
  )
}

/* ============================ Pagination ============================ */

interface PaginationProps {
  currentPage: number
  totalPages: number
  shownCount: number
  totalCount: number
  onPageChange: (page: number) => void
}

function Pagination({
  currentPage,
  totalPages,
  shownCount,
  totalCount,
  onPageChange,
}: PaginationProps) {
  // Build a page-number list with up to 5 buttons + ellipsis.
  const pages = useMemo(() => {
    const result: (number | 'ellipsis')[] = []
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) result.push(i)
      return result
    }
    const first = 1
    const last = totalPages
    if (currentPage <= 3) {
      result.push(1, 2, 3, 4, 'ellipsis', last)
    } else if (currentPage >= totalPages - 2) {
      result.push(first, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      result.push(
        first,
        'ellipsis',
        currentPage - 1,
        currentPage,
        currentPage + 1,
        'ellipsis',
        last,
      )
    }
    return result
  }, [currentPage, totalPages])

  return (
    <div className="mt-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
      <span className="text-sm text-muted-foreground">
        Mostrando {shownCount} de {totalCount} {totalCount === 1 ? 'venda' : 'vendas'}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          className="h-11 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Página anterior"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        {pages.map((p, idx) =>
          p === 'ellipsis' ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex h-11 w-9 items-center justify-center text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? 'default' : 'outline'}
              className="h-11 min-w-[2.75rem] px-3 text-sm"
              aria-label={`Página ${p}`}
              aria-current={p === currentPage ? 'page' : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          className="h-11 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Próxima página"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        >
          Próximo
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/* ============================ States ============================ */

function SalesTableSkeleton() {
  return (
    <>
      <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="h-12 bg-muted hover:bg-muted">
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Data/Hora
              </TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Canal
              </TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Itens
              </TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Forma de Pagamento
              </TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Valor Total
              </TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Comissão iFood
              </TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Taxa de Entrega
              </TableHead>
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Valor Líquido
              </TableHead>
              <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i} className="h-16 border-t border-border">
                <TableCell className="px-4">
                  <Skeleton className="h-5 w-28 rounded-md" />
                </TableCell>
                <TableCell className="px-4">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell className="px-4">
                  <Skeleton className="h-5 w-10 rounded-md" />
                </TableCell>
                <TableCell className="px-4">
                  <Skeleton className="h-5 w-28 rounded-md" />
                </TableCell>
                <TableCell className="px-4">
                  <Skeleton className="h-5 w-24 rounded-md" />
                </TableCell>
                <TableCell className="px-4">
                  <Skeleton className="h-5 w-20 rounded-md" />
                </TableCell>
                <TableCell className="px-4">
                  <Skeleton className="h-5 w-20 rounded-md" />
                </TableCell>
                <TableCell className="px-4">
                  <Skeleton className="h-5 w-24 rounded-md" />
                </TableCell>
                <TableCell className="px-4 text-right">
                  <Skeleton className="h-9 w-32 rounded-md" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Mobile skeleton */}
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4"
          >
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((__, j) => (
                <Skeleton key={j} className="h-5 w-24 rounded-md" />
              ))}
            </div>
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        ))}
      </div>
    </>
  )
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border bg-card p-12 text-center">
      <ShoppingCart className="h-16 w-16 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-bold text-foreground">Nenhuma venda encontrada</h2>
      <p className="mt-2 max-w-[360px] text-sm text-muted-foreground">
        Não há vendas registradas com os filtros selecionados.
      </p>
      {!hasFilters && (
        <p className="mt-1 max-w-[360px] text-sm text-muted-foreground">
          Registre vendas pelo PDV ou importe pedidos do iFood para começar.
        </p>
      )}
      {hasFilters && (
        <Button variant="ghost" onClick={onClear} className="mt-6 h-11 px-5">
          Limpar filtros
        </Button>
      )}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border bg-card p-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">Erro ao carregar vendas</h2>
      <p className="mt-2 max-w-[360px] text-sm text-muted-foreground">
        Não foi possível carregar o histórico de vendas.
      </p>
      <Button onClick={onRetry} variant="outline" className="mt-6 h-11 px-6">
        Tentar novamente
      </Button>
    </div>
  )
}

// PackageSearch imported for potential use; kept to satisfy the icon import spec.
void PackageSearch
