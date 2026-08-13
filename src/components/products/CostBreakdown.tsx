import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Calculator, Info, Loader2, RotateCcw, SlidersHorizontal } from 'lucide-react'

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
  const [ifoodInput, setIfoodInput] = useState('')

  const disabled = totalCost === null || totalCost <= 0 || loading

  // iFood commission (0 when empty/invalid).
  const ifoodCommission = useMemo(() => {
    const v = parseFloat(ifoodInput.replace(',', '.'))
    return Number.isFinite(v) && v > 0 ? v : 0
  }, [ifoodInput])
  const hasIfood = ifoodCommission > 0

  // suggestedPrice = totalCost / (1 - ifoodCommission/100 - margin/100)
  // (without iFood: totalCost / (1 - margin/100), unchanged from before)
  const suggested = useMemo(() => {
    if (disabled || totalCost === null) {
      return { price: null as number | null, error: false as boolean }
    }
    const m = parseFloat(marginInput.replace(',', '.'))
    if (!Number.isFinite(m) || m <= -Infinity) return { price: null, error: false }

    const factor = 1 - ifoodCommission / 100 - m / 100
    if (hasIfood && factor <= 0) return { price: null, error: true }
    if (!hasIfood && (m >= 100 || factor <= 0)) return { price: null, error: false }
    if (factor <= 0) return { price: null, error: false }
    return { price: totalCost / factor, error: false }
  }, [marginInput, totalCost, disabled, ifoodCommission, hasIfood])

  const suggestedPrice = suggested.price
  const suggestedError = suggested.error

  // iFood commission amount + net profit for the suggested-price mode.
  const suggestedIfoodAmount = useMemo(() => {
    if (suggestedPrice === null) return 0
    return (suggestedPrice * ifoodCommission) / 100
  }, [suggestedPrice, ifoodCommission])
  const suggestedNetProfit = useMemo(() => {
    if (suggestedPrice === null || totalCost === null) return null
    return suggestedPrice - totalCost - suggestedIfoodAmount
  }, [suggestedPrice, totalCost, suggestedIfoodAmount])

  // resultingMargin = (1 - totalCost/price - ifoodCommission/100) * 100
  // (without iFood: ((price - totalCost) / price) * 100, unchanged)
  const resultingMargin = useMemo(() => {
    if (disabled || totalCost === null) return null
    const p = parseFloat(priceInput.replace(',', '.'))
    if (!Number.isFinite(p) || p <= 0) return null
    if (hasIfood) {
      return (1 - totalCost / p - ifoodCommission / 100) * 100
    }
    return ((p - totalCost) / p) * 100
  }, [priceInput, totalCost, disabled, hasIfood, ifoodCommission])

  // iFood commission amount + net profit for the desired-price mode.
  const priceIfoodAmount = useMemo(() => {
    if (!hasIfood || resultingMargin === null) return 0
    const p = parseFloat(priceInput.replace(',', '.'))
    if (!Number.isFinite(p) || p <= 0) return 0
    return (p * ifoodCommission) / 100
  }, [hasIfood, resultingMargin, priceInput])
  const priceNetProfit = useMemo(() => {
    if (!hasIfood || resultingMargin === null || totalCost === null) return null
    const p = parseFloat(priceInput.replace(',', '.'))
    if (!Number.isFinite(p) || p <= 0) return null
    return p - totalCost - priceIfoodAmount
  }, [hasIfood, resultingMargin, totalCost, priceInput, priceIfoodAmount])

  function handleApply() {
    if (suggestedPrice === null) return
    // pt-BR format with comma decimal separator, 2 decimals.
    const formatted = suggestedPrice.toFixed(2).replace('.', ',')
    onApplyPrice(formatted)
    toast.success(
      hasIfood
        ? 'Preço atualizado com base na margem e comissão iFood.'
        : 'Preço atualizado com base na margem.',
    )
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
        {/* iFood commission — disabled when cost is unavailable */}
        <div className="mt-3">
          <Label
            htmlFor="sim-ifood"
            className="mb-2 block text-sm font-medium text-muted-foreground"
          >
            Comissão iFood (%)
          </Label>
          <Input
            id="sim-ifood"
            type="number"
            inputMode="decimal"
            step={0.1}
            placeholder="Ex: 20"
            disabled
            aria-label="Comissão do iFood em porcentagem"
            className="h-11 rounded-[var(--radius)] border-input bg-muted text-sm"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Cadastre compras dos insumos para calcular o custo e usar o simulador.
          </p>
        </div>
        {/* Info note */}
        <p
          className="flex items-start text-xs text-muted-foreground"
          style={{ fontSize: '0.75rem', gap: '0.375rem', marginTop: '0.375rem' }}
        >
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          A comissão do iFood varia entre 18% e 27% dependendo do plano e região. Verifique sua taxa
          no portal do parceiro iFood.
        </p>
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
          {suggestedError ? (
            <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              Margem e comissão somam 100% ou mais. Ajuste os valores.
            </p>
          ) : suggestedPrice !== null ? (
            hasIfood ? (
              <div className="mt-2 space-y-0.5">
                <div className="rounded-[var(--radius)] bg-accent/10 px-3 py-2 text-[1.125rem] font-bold text-accent-foreground">
                  Preço sugerido: <span className="tabular-nums">{formatBRL(suggestedPrice)}</span>
                </div>
                <p className="text-[0.8125rem] text-muted-foreground tabular-nums">
                  Comissão iFood: {formatBRL(suggestedIfoodAmount)}
                </p>
                {suggestedNetProfit !== null && (
                  <p
                    className={cn(
                      'text-[0.8125rem] font-semibold tabular-nums',
                      suggestedNetProfit >= 0
                        ? 'text-emerald-600 dark:text-emerald-500'
                        : 'text-destructive',
                    )}
                  >
                    Lucro líquido: {formatBRL(suggestedNetProfit)}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-2 rounded-[var(--radius)] bg-accent/10 px-3 py-2 text-sm font-medium text-accent-foreground">
                Preço sugerido:{' '}
                <span className="tabular-nums font-bold">{formatBRL(suggestedPrice)}</span>
              </div>
            )
          ) : null}
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
          {resultingMargin !== null &&
            (hasIfood ? (
              <div className="mt-2 space-y-0.5">
                <div
                  className={cn(
                    'rounded-[var(--radius)] px-3 py-2 text-sm font-medium',
                    resultingMargin >= 0
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-destructive/10 text-destructive',
                  )}
                >
                  Margem resultante:{' '}
                  <span className="tabular-nums font-bold">{formatNumber(resultingMargin)}%</span>
                </div>
                <p className="text-[0.8125rem] text-muted-foreground tabular-nums">
                  Comissão iFood: {formatBRL(priceIfoodAmount)}
                </p>
                {priceNetProfit !== null && (
                  <p
                    className={cn(
                      'text-[0.8125rem] font-semibold tabular-nums',
                      priceNetProfit >= 0
                        ? 'text-emerald-600 dark:text-emerald-500'
                        : 'text-destructive',
                    )}
                  >
                    Lucro líquido: {formatBRL(priceNetProfit)}
                  </p>
                )}
              </div>
            ) : (
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
            ))}
        </div>
      </div>

      {/* Input 3: iFood commission — full-width row below the two simulators */}
      <div className="mt-3">
        <Label htmlFor="sim-ifood" className="mb-2 block text-sm font-medium text-foreground">
          Comissão iFood (%)
        </Label>
        <div className="relative">
          <Input
            id="sim-ifood"
            type="number"
            inputMode="decimal"
            step={0.1}
            placeholder="Ex: 20"
            disabled={loading}
            value={ifoodInput}
            onChange={(e) => setIfoodInput(e.target.value)}
            aria-label="Comissão do iFood em porcentagem"
            className="h-11 pr-9 rounded-[var(--radius)] border-input bg-background text-sm focus-visible:ring-2 focus-visible:ring-ring/20"
          />
          {loading && (
            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Percentual cobrado pelo iFood sobre o preço de venda. Varia entre 18% e 27% conforme o
          plano.
        </p>
        <p
          className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground"
          style={{ fontSize: '0.75rem', marginTop: '0.375rem' }}
        >
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          A comissão do iFood varia entre 18% e 27% dependendo do plano e região. Verifique sua taxa
          no portal do parceiro iFood.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-4 h-11 gap-2 px-4"
        disabled={suggestedPrice === null || suggestedError || loading}
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
