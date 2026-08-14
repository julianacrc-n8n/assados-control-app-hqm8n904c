import { AlertCircle, PackageSearch, ShoppingBag, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSaleDetails } from '@/hooks/useSaleDetails'
import { formatBRL, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Sale } from '@/types'

interface SaleDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  saleId: string | null
}

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

function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} às ${hh}:${min}`
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
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {PAYMENT_LABELS[method] ?? method}
    </span>
  )
}

function NetValue({ sale }: { sale: Sale }) {
  const net = sale.total - (sale.ifoodCommission ?? 0)
  const positive = net >= 0
  return (
    <span className={cn('font-bold', positive ? 'text-green-600' : 'text-red-600')}>
      {formatBRL(net)}
    </span>
  )
}

function SummaryField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  )
}

export function SaleDetailSheet({ open, onOpenChange, saleId }: SaleDetailSheetProps) {
  const isMobile = useIsMobile()
  const { sale, items, loading, error, refetch } = useSaleDetails(open ? saleId : null)
  const isCash = sale?.paymentMethod === 'dinheiro'
  const itemsTotal = items.reduce((sum, i) => sum + i.subtotal, 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex w-full flex-col gap-0 p-0',
          isMobile ? 'max-h-[90vh] rounded-t-[var(--radius)]' : 'sm:max-w-[480px]',
        )}
      >
        <SheetHeader
          className="flex flex-col space-y-0 border-b border-border p-6"
          aria-labelledby="sale-detail-title"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle id="sale-detail-title" className="text-lg font-bold">
                  Detalhes da Venda
                </SheetTitle>
                <SheetDescription className="mt-1 text-sm text-muted-foreground">
                  {sale && !loading && !error
                    ? formatDateTime(typeof sale.date === 'string' ? sale.date : '')
                    : ''}
                </SheetDescription>
                {sale && !loading && !error && (
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{sale.id}</p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              aria-label="Fechar"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div
          className="flex-1 overflow-y-auto p-6"
          style={{ maxHeight: isMobile ? 'calc(90vh - 8rem)' : 'calc(100vh - 8rem)' }}
        >
          {loading ? (
            <SaleDetailSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                Erro ao carregar detalhes
              </h3>
              <p className="mt-1 max-w-[280px] text-xs text-muted-foreground">
                {error || 'Não foi possível carregar os detalhes da venda.'}
              </p>
              <Button variant="outline" className="mt-4 h-11 px-5" onClick={refetch}>
                Tentar novamente
              </Button>
            </div>
          ) : sale ? (
            <>
              {/* Section 1 — Resumo */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Resumo</h3>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SummaryField label="Canal">
                    <ChannelBadge channel={sale.salesChannel} />
                  </SummaryField>
                  <SummaryField label="Forma de Pagamento">
                    <PaymentLabel method={sale.paymentMethod} />
                  </SummaryField>
                  <SummaryField label="Valor dos Itens">{formatBRL(itemsTotal)}</SummaryField>
                  <SummaryField label="Taxa de Entrega">
                    {sale.deliveryFee > 0 ? formatBRL(sale.deliveryFee) : 'Sem taxa'}
                  </SummaryField>
                  <SummaryField label="Comissão iFood">
                    {sale.ifoodCommission ? formatBRL(sale.ifoodCommission) : 'Sem comissão'}
                  </SummaryField>
                  <SummaryField label="Valor Total">
                    <span className="font-bold">{formatBRL(sale.total)}</span>
                  </SummaryField>
                  <SummaryField label="Valor Recebido">
                    {isCash
                      ? sale.amountPaid != null
                        ? formatBRL(sale.amountPaid)
                        : 'N/A'
                      : 'N/A'}
                  </SummaryField>
                  <SummaryField label="Troco">
                    {isCash ? (sale.change != null ? formatBRL(sale.change) : 'N/A') : 'N/A'}
                  </SummaryField>
                  <SummaryField label="Valor Líquido">
                    <NetValue sale={sale} />
                  </SummaryField>
                  <SummaryField label="Senha de Retirada">
                    {sale.pickupCode ? (
                      <span
                        className="font-mono text-[1.125rem] font-bold tracking-[0.25rem]"
                        aria-label="Senha de retirada do pedido"
                      >
                        {sale.pickupCode}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Sem senha</span>
                    )}
                  </SummaryField>
                </dl>
              </section>

              {/* Section 2 — Itens Vendidos */}
              <section className="mt-6">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Itens Vendidos ({items.length})
                </h3>
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border bg-card p-6 text-center">
                    <PackageSearch className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium text-foreground">
                      Esta venda não possui itens registrados.
                    </p>
                    <p className="mt-1 max-w-[320px] text-xs text-muted-foreground">
                      Vendas importadas do iFood sem o Passo 2 (Cardápio) não têm itens individuais.
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {items.map((item) => (
                      <li
                        key={item.productId}
                        className="rounded-[var(--radius)] border border-border bg-card p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">
                            {item.productName}
                          </p>
                          <p className="tabular-nums text-sm font-bold text-foreground">
                            {formatBRL(item.subtotal)}
                          </p>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="tabular-nums">{formatNumber(item.quantity)}x</span>
                          <span className="tabular-nums">{formatBRL(item.unitPrice)} un</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma venda selecionada.</p>
          )}
        </div>

        <div className="border-t border-border p-4">
          <Button variant="outline" className="h-11 w-full" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SaleDetailSkeleton() {
  return (
    <>
      <h3 className="mb-3 text-sm font-semibold text-foreground">Resumo</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-20 rounded-md" />
            <Skeleton className="h-5 w-28 rounded-md" />
          </div>
        ))}
      </div>
      <h3 className="mb-3 mt-6 text-sm font-semibold text-foreground">Itens Vendidos</h3>
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="rounded-[var(--radius)] border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <div className="mt-2 flex gap-4">
              <Skeleton className="h-3 w-10 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
