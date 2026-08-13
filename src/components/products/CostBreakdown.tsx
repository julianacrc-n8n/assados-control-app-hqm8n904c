import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Calculator, Loader2, RotateCcw, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useProductCost } from '@/hooks/useProductCost'
import { formatBRL, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RecipeItem } from '@/types'

interface CostBreakdownProps {
  /** The product being edited. */
  productId: string
  /** Current price (form state) so the margin reflects the live value. */
  price: number
  /**
   * Latest recipe items array (same one rendered by the RecipeEditor).
   * Used as a refetch trigger: whenever it changes, costs are recomputed.
   */
  recipeItems: RecipeItem[]
  /** Imperative setter for the form's price field (the simulator's "apply"). */
  onApplyPrice: (value: string) => void
  /** Ref to the price input, so we can scroll to it after applying. */
  priceInputRef: React.RefObject<HTMLInputElement | null>
}

/**
 * Cost breakdown + profit analysis + margin simulator, shown inside the
 * edit Sheet below the recipe items list. Only the data-fetching lives here;
 * the recipe editor itself is untouched.
 */
export function CostBreakdown({
  productId,
  price,
  recipeItems,
  onApplyPrice,
  priceInputRef,
}: CostBreakdownProps) {
  const { costBreakdown, totalCost, margin, loading, error, refetch } = useProductCost(
    productId,
    price,
    recipeItems,
  )

  return (
    <div className="mt-6 border-t border-border pt-6">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-bold text-foreground">Custo de Produção</h3>
        </div>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          Calculado com base no último preço de compra de cada insumo.
        </p>
      </div>

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-[var(--radius)] border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Não foi possível calcular o custo.</span>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 px-4"
            onClick={() => refetch()}
          >
            <RotateCcw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      ) : loading ? (
        <CostBreakdownSkeleton />
      ) : (
        <>
          <CostTable lines={costBreakdown} totalCost={totalCost} />
          <ProfitAnalysis price={price} totalCost={totalCost} margin={margin} />
          <MarginSimulator
            totalCost={totalCost}
            loading={loading}
            onApplyPrice={onApplyPrice}
            priceInputRef={priceInputRef}
          />
        </>
      )}
    </div>
  )
}

/* ---------------- Cost table ---------------- */

function CostTable({
  lines,
  totalCost,
}: {
  lines: {
    ingredientName: string
    unit: string
    quantity: number
    unitCost: number | null
    lineCost: number | null
  }[]
  totalCost: number | null
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-border">
      {/* Desktop: real table */}
      <Table>
        <TableHeader>
          <TableRow className="h-10 bg-muted hover:bg-muted">
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Insumo
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Quantidade
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Custo Unitário
            </TableHead>
            <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Subtotal
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, idx) => (
            <TableRow
              key={idx}
              className={cn(
                'border-t border-border text-sm',
                line.unitCost === null && 'text-muted-foreground/70',
              )}
            >
              <TableCell className="px-3 font-semibold text-foreground">
                {line.ingredientName}
              </TableCell>
              <TableCell className="tabular-nums px-3">
                {formatNumber(line.quantity)} {line.unit}
              </TableCell>
              <TableCell className="px-3 tabular-nums">
                {line.unitCost === null ? (
                  <span className="text-muted-foreground">Sem registro</span>
                ) : (
                  formatBRL(line.unitCost)
                )}
              </TableCell>
              <TableCell className="tabular-nums px-3 text-right font-semibold">
                {line.lineCost === null ? (
                  <span className="font-normal text-muted-foreground">—</span>
                ) : (
                  formatBRL(line.lineCost)
                )}
              </TableCell>
            </TableRow>
          ))}
          {/* Total row */}
          <TableRow className="border-t-2 border-border bg-muted/40 hover:bg-muted/40">
            <TableCell colSpan={3} className="px-3 text-sm font-bold text-foreground">
              Custo Total
            </TableCell>
            <TableCell className="px-3 text-right text-base font-bold tabular-nums text-foreground">
              {totalCost === null ? (
                <span className="text-sm font-normal text-muted-foreground">
                  Sem dados de custo
                </span>
              ) : (
                formatBRL(totalCost)
              )}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {/* Mobile: stacked rows */}
      <div className="divide-y divide-border md:hidden">
        {lines.map((line, idx) => (
          <div key={idx} className={cn('space-y-1 p-3', line.unitCost === null && 'opacity-70')}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{line.ingredientName}</span>
              <span className="tabular-nums text-sm">
                {formatNumber(line.quantity)} {line.unit}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <div>
                <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                  Custo Unitário
                </p>
                <p className="tabular-nums">
                  {line.unitCost === null ? (
                    <span className="text-muted-foreground">Sem registro</span>
                  ) : (
                    formatBRL(line.unitCost)
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                  Subtotal
                </p>
                <p className="tabular-nums font-semibold">
                  {line.lineCost === null ? (
                    <span className="font-normal text-muted-foreground">—</span>
                  ) : (
                    formatBRL(line.lineCost)
                  )}
                </p>
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 bg-muted/40 p-3">
          <span className="text-sm font-bold text-foreground">Custo Total</span>
          {totalCost === null ? (
            <span className="text-sm text-muted-foreground">Sem dados de custo</span>
          ) : (
            <span className="text-base font-bold tabular-nums text-foreground">
              {formatBRL(totalCost)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Profit analysis ---------------- */

function ProfitAnalysis({
  price,
  totalCost,
  margin,
}: {
  price: number
  totalCost: number | null
  margin: number | null
}) {
  const absoluteMargin = totalCost !== null ? price - totalCost : null
  const positive = absoluteMargin !== null && absoluteMargin >= 0
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Preço de Venda */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Preço de Venda</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{formatBRL(price)}</p>
      </div>
      {/* Margem de Lucro */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Margem de Lucro</p>
        {absoluteMargin === null ? (
          <p className="mt-1 text-xl font-bold text-muted-foreground">Indisponível</p>
        ) : (
          <p
            className={cn(
              'mt-1 text-xl font-bold tabular-nums',
              positive ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive',
            )}
          >
            {formatBRL(absoluteMargin)}{' '}
            <span className="text-base font-semibold">
              ({margin !== null ? formatNumber(margin) : '—'}%)
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

/* ---------------- Margin simulator ---------------- */

function MarginSimulator({
  totalCost,
  loading,
  onApplyPrice,
  priceInputRef,
}: {
  totalCost: number | null
  loading: boolean
  onApplyPrice: (value: string) => void
  priceInputRef: React.RefObject<HTMLInputElement | null>
}) {
  const [marginInput, setMarginInput] = useState('')
  const [priceInput, setPriceInput] = useState('')

  const disabled = totalCost === null || totalCost <= 0 || loading

  // suggestedPrice = totalCost / (1 - margin/100)
  const suggestedPrice = useMemo(() => {
    if (disabled || totalCost === null) return null
    const m = parseFloat(marginInput.replace(',', '.'))
    if (!Number.isFinite(m) || m >= 100 || m <= -Infinity) return null
    const factor = 1 - m / 100
    if (factor <= 0) return null
    return totalCost / factor
  }, [marginInput, totalCost, disabled])

  // resultingMargin = ((price - totalCost) / price) * 100
  const resultingMargin = useMemo(() => {
    if (disabled || totalCost === null) return null
    const p = parseFloat(priceInput.replace(',', '.'))
    if (!Number.isFinite(p) || p <= 0) return null
    return ((p - totalCost) / p) * 100
  }, [priceInput, totalCost, disabled])

  function handleApply() {
    if (suggestedPrice === null) return
    // pt-BR format with comma decimal separator, 2 decimals.
    const formatted = suggestedPrice.toFixed(2).replace('.', ',')
    onApplyPrice(formatted)
    toast.success('Preço atualizado com base na margem.')
    // Brief scroll to the price field.
    const el = priceInputRef.current
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.focus({ preventScroll: true })
      el.classList.add('animate-flash-highlight')
      window.setTimeout(() => el.classList.remove('animate-flash-highlight'), 600)
    }
  }

  if (disabled) {
    return (
      <div className="mt-6 rounded-[var(--radius)] border border-dashed border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-foreground">Simulador de Preço</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Cadastre compras dos insumos para calcular o custo e usar o simulador.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SimulatorInputDisabled />
          <SimulatorInputDisabled />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-[var(--radius)] border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold text-foreground">Simulador de Preço</h4>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Input 1: desired margin → suggested price */}
        <div>
          <Label htmlFor="sim-margin" className="mb-2 block text-sm font-medium text-foreground">
            Margem Desejada (%)
          </Label>
          <div className="relative">
            <Input
              id="sim-margin"
              type="number"
              inputMode="decimal"
              step={0.1}
              placeholder="Ex: 50"
              disabled={loading}
              value={marginInput}
              onChange={(e) => setMarginInput(e.target.value)}
              className="h-11 pr-9 rounded-[var(--radius)] border-input bg-background text-sm focus-visible:ring-2 focus-visible:ring-ring/20"
              aria-label="Margem desejada em porcentagem"
            />
            {loading && (
              <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {suggestedPrice !== null && (
            <div className="mt-2 rounded-[var(--radius)] bg-accent/10 px-3 py-2 text-sm font-medium text-accent-foreground">
              Preço sugerido:{' '}
              <span className="tabular-nums font-bold">{formatBRL(suggestedPrice)}</span>
            </div>
          )}
        </div>

        {/* Input 2: desired price → resulting margin */}
        <div>
          <Label htmlFor="sim-price" className="mb-2 block text-sm font-medium text-foreground">
            Preço Desejado (R$)
          </Label>
          <div className="relative">
            <Input
              id="sim-price"
              type="number"
              inputMode="decimal"
              step={0.01}
              placeholder="Ex: 15,00"
              disabled={loading}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="h-11 pr-9 rounded-[var(--radius)] border-input bg-background text-sm focus-visible:ring-2 focus-visible:ring-ring/20"
              aria-label="Preço desejado em reais"
            />
            {loading && (
              <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {resultingMargin !== null && (
            <div
              className={cn(
                'mt-2 rounded-[var(--radius)] px-3 py-2 text-sm font-medium',
                resultingMargin >= 0
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-destructive/10 text-destructive',
              )}
            >
              Margem resultante:{' '}
              <span className="tabular-nums font-bold">{formatNumber(resultingMargin)}%</span>
            </div>
          )}
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-4 h-11 gap-2 px-4"
        disabled={suggestedPrice === null || loading}
        onClick={handleApply}
        aria-label="Aplicar preço sugerido ao campo de preço"
      >
        Aplicar Preço Sugerido
      </Button>
    </div>
  )
}

function SimulatorInputDisabled() {
  return (
    <div>
      <Label className="mb-2 block text-sm font-medium text-muted-foreground">—</Label>
      <Input
        type="number"
        disabled
        className="h-11 rounded-[var(--radius)] border-input bg-muted text-sm"
      />
    </div>
  )
}

/* ---------------- Skeleton ---------------- */

function CostBreakdownSkeleton() {
  return (
    <div>
      <div className="overflow-hidden rounded-[var(--radius)] border border-border">
        <Table>
          <TableHeader>
            <TableRow className="h-10 bg-muted hover:bg-muted">
              <TableHead className="px-3 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Insumo
              </TableHead>
              <TableHead className="px-3 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Quantidade
              </TableHead>
              <TableHead className="px-3 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Custo Unitário
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Subtotal
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i} className="border-t border-border">
                <TableCell className="px-3">
                  <Skeleton className="h-4 w-28 rounded-md" />
                </TableCell>
                <TableCell className="px-3">
                  <Skeleton className="h-4 w-16 rounded-md" />
                </TableCell>
                <TableCell className="px-3">
                  <Skeleton className="h-4 w-20 rounded-md" />
                </TableCell>
                <TableCell className="px-3 text-right">
                  <Skeleton className="ml-auto h-4 w-20 rounded-md" />
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 border-border bg-muted/40 hover:bg-muted/40">
              <TableCell colSpan={3} className="px-3">
                <Skeleton className="h-5 w-24 rounded-md" />
              </TableCell>
              <TableCell className="px-3 text-right">
                <Skeleton className="ml-auto h-6 w-28 rounded-md" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Pulsing profit + simulator */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-[72px] w-full rounded-[var(--radius)]" />
        <Skeleton className="h-[72px] w-full rounded-[var(--radius)]" />
      </div>
      <Skeleton className="mt-4 h-[180px] w-full rounded-[var(--radius)]" />
    </div>
  )
}
