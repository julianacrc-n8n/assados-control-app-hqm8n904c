import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, AlertTriangle, Loader2, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatBRL } from '@/lib/format'
import type { Ingredient, PurchaseInput } from '@/types'

interface PurchaseFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredients: Ingredient[]
  ingredientsLoading: boolean
  createPurchase: (
    purchase: PurchaseInput,
    items: {
      ingredientId: string
      quantity: number
      unitCost: number
    }[],
  ) => Promise<unknown>
  /** Switches the parent tabs to the Insumos tab. */
  onGoToIngredients: () => void
}

interface ItemRow {
  key: string
  ingredientId: string
  quantity: string
  unitCost: string
}

let rowSeq = 0
function newRow(): ItemRow {
  rowSeq += 1
  return { key: `row-${rowSeq}`, ingredientId: '', quantity: '', unitCost: '' }
}

function parseNum(value: string): number {
  const n = parseFloat(value.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function PurchaseFormSheet({
  open,
  onOpenChange,
  ingredients,
  ingredientsLoading,
  createPurchase,
  onGoToIngredients,
}: PurchaseFormSheetProps) {
  const [supplier, setSupplier] = useState('')
  const [date, setDate] = useState(todayISO())
  const [rows, setRows] = useState<ItemRow[]>([newRow()])
  const [errors, setErrors] = useState<{ date?: string; items?: string }>({})
  const [saving, setSaving] = useState(false)

  // Reset form whenever the sheet opens.
  useEffect(() => {
    if (!open) return
    setSupplier('')
    setDate(todayISO())
    setRows([newRow()])
    setErrors({})
  }, [open])

  const ingredientById = useMemo(() => {
    const map = new Map<string, Ingredient>()
    for (const i of ingredients) map.set(i.id, i)
    return map
  }, [ingredients])

  const noIngredients = ingredients.length === 0 && !ingredientsLoading

  function updateRow(key: string, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    if (errors.items) setErrors((e) => ({ ...e, items: undefined }))
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()])
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)))
  }

  // Valid items (ingredient selected + quantity > 0 + unitCost >= 0).
  const validItems = useMemo(() => {
    return rows
      .map((r) => {
        const qty = parseNum(r.quantity)
        const cost = parseNum(r.unitCost)
        const valid =
          r.ingredientId !== '' &&
          Number.isFinite(qty) &&
          qty > 0 &&
          Number.isFinite(cost) &&
          cost >= 0
        return valid
          ? {
              key: r.key,
              ingredientId: r.ingredientId,
              quantity: qty,
              unitCost: cost,
            }
          : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [rows])

  const total = useMemo(
    () => validItems.reduce((sum, i) => sum + i.quantity * i.unitCost, 0),
    [validItems],
  )

  function validate(): boolean {
    const next: { date?: string; items?: string } = {}
    if (!date) next.date = 'A data é obrigatória.'
    if (validItems.length === 0) next.items = 'Adicione pelo menos um item à compra.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (noIngredients) return
    if (!validate()) return
    setSaving(true)
    try {
      const payload: PurchaseInput = {
        supplier: supplier.trim().slice(0, 200) || null,
        total,
        date,
      }
      await createPurchase(
        payload,
        validItems.map((i) => ({
          ingredientId: i.ingredientId,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      )
      toast.success('Compra registrada com sucesso. Estoque atualizado.')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar compra.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        <SheetHeader className="flex flex-col space-y-0 border-b border-border p-6">
          <SheetTitle className="text-lg font-bold">Registrar Compra</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            Registre uma compra de insumos para atualizar o estoque automaticamente.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6"
          style={{ maxHeight: 'calc(100vh - 8rem)' }}
        >
          {/* No-ingredients warning */}
          {noIngredients && (
            <div
              className="mb-5 flex items-center gap-2 rounded-[var(--radius)] px-4 py-3"
              style={{
                backgroundColor: 'hsl(var(--destructive) / 0.1)',
                border: '1px solid hsl(var(--destructive) / 0.3)',
              }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-[0.8125rem] text-foreground">
                Você precisa cadastrar insumos antes de registrar uma compra.{' '}
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false)
                    onGoToIngredients()
                  }}
                  className="font-medium text-accent-foreground underline underline-offset-4"
                >
                  Ir para Insumos.
                </button>
              </p>
            </div>
          )}

          {/* Supplier */}
          <div className="mb-5">
            <Label
              htmlFor="purchase-supplier"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Fornecedor
            </Label>
            <Input
              id="purchase-supplier"
              value={supplier}
              maxLength={200}
              placeholder="Ex: Distribuidora Alimentos LTDA"
              className="h-11 rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
              disabled={saving}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="mb-5">
            <Label
              htmlFor="purchase-date"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Data da Compra <span className="text-destructive">*</span>
            </Label>
            <Input
              id="purchase-date"
              type="date"
              value={date}
              className="h-11 rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
              aria-invalid={!!errors.date}
              aria-describedby={errors.date ? 'purchase-date-error' : undefined}
              disabled={saving}
              onChange={(e) => {
                setDate(e.target.value)
                if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }))
              }}
            />
            {errors.date && (
              <p
                id="purchase-date-error"
                className="mt-1.5 flex items-center gap-1 text-xs text-destructive"
              >
                <AlertCircle className="h-3 w-3" />
                {errors.date}
              </p>
            )}
          </div>

          {/* Items */}
          <div className="mb-3">
            <Label className="mb-2 block text-sm font-medium text-foreground">Itens</Label>
          </div>

          <ul className="space-y-3">
            {rows.map((row, idx) => {
              const ing = row.ingredientId ? ingredientById.get(row.ingredientId) : null
              const unit = ing?.unit ?? ''
              const qty = parseNum(row.quantity)
              const cost = parseNum(row.unitCost)
              const subtotal = Number.isFinite(qty) && Number.isFinite(cost) ? qty * cost : 0
              return (
                <li
                  key={row.key}
                  className="rounded-[var(--radius)] border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Item {idx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      aria-label="Remover item"
                      disabled={saving || rows.length === 1}
                      onClick={() => removeRow(row.key)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-col gap-3">
                    {/* Ingredient select */}
                    <div>
                      <Label
                        htmlFor={`item-ingredient-${row.key}`}
                        className="mb-1.5 block text-xs font-medium text-muted-foreground"
                      >
                        Insumo
                      </Label>
                      <Select
                        value={row.ingredientId}
                        onValueChange={(v) => updateRow(row.key, { ingredientId: v })}
                        disabled={saving || noIngredients}
                      >
                        <SelectTrigger
                          id={`item-ingredient-${row.key}`}
                          className="h-11 rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
                        >
                          <SelectValue placeholder="Selecione um insumo" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name} ({i.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quantity + unit */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <Label
                          htmlFor={`item-quantity-${row.key}`}
                          className="mb-1.5 block text-xs font-medium text-muted-foreground"
                        >
                          Quantidade
                        </Label>
                        <Input
                          id={`item-quantity-${row.key}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={0.01}
                          placeholder="Quantidade"
                          value={row.quantity}
                          className="h-11 rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
                          disabled={saving}
                          onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                        />
                      </div>
                      <span className="pb-2.5 text-sm text-muted-foreground">{unit || '—'}</span>
                    </div>

                    {/* Unit cost */}
                    <div>
                      <Label
                        htmlFor={`item-unitcost-${row.key}`}
                        className="mb-1.5 block text-xs font-medium text-muted-foreground"
                      >
                        Preço Unitário (R$)
                      </Label>
                      <Input
                        id={`item-unitcost-${row.key}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        placeholder="Preço Unitário (R$)"
                        value={row.unitCost}
                        className="h-11 rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
                        disabled={saving}
                        onChange={(e) => updateRow(row.key, { unitCost: e.target.value })}
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="flex items-center justify-between rounded-[var(--radius)] bg-muted/50 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums text-sm font-semibold text-foreground">
                        {formatBRL(subtotal)}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {errors.items && (
            <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.items}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="mt-3 h-11 w-full gap-2"
            disabled={saving || noIngredients}
            onClick={addRow}
          >
            <Plus className="h-4 w-4" />
            Adicionar Item
          </Button>

          {/* Total */}
          <div className="mt-5 flex items-center justify-between rounded-[var(--radius)] border border-border bg-card px-4 py-4">
            <span className="text-sm font-medium text-foreground">Total</span>
            <span className="tabular-nums text-2xl font-bold text-foreground">
              {formatBRL(total)}
            </span>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 px-6"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="h-11 px-6" disabled={saving || noIngredients}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrar Compra'
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
