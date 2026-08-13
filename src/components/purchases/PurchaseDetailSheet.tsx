import { Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatBRL, formatNumber } from '@/lib/format'
import type { Ingredient, Purchase, PurchaseItem } from '@/types'

interface PurchaseDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchase: Purchase | null
  items: PurchaseItem[]
  ingredients: Ingredient[]
  loading: boolean
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function PurchaseDetailSheet({
  open,
  onOpenChange,
  purchase,
  items,
  ingredients,
  loading,
}: PurchaseDetailSheetProps) {
  const ingredientById = new Map<string, Ingredient>()
  for (const i of ingredients) ingredientById.set(i.id, i)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        <SheetHeader className="flex flex-col space-y-0 border-b border-border p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-lg font-bold">Detalhes da Compra</SheetTitle>
              <SheetDescription className="mt-1 text-sm text-muted-foreground">
                Informações e itens da compra.
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              aria-label="Fechar"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : purchase ? (
            <>
              <dl className="grid grid-cols-1 gap-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Fornecedor
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">
                    {purchase.supplier || 'Sem fornecedor'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Data
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">
                    {formatDate(purchase.date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total
                  </dt>
                  <dd className="mt-0.5 text-base font-bold text-foreground">
                    {formatBRL(purchase.total)}
                  </dd>
                </div>
              </dl>

              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Itens ({items.length})
                </h3>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum item encontrado para esta compra.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((item) => {
                      const ing = ingredientById.get(item.ingredientId)
                      const name = ing?.name ?? 'Insumo removido'
                      const unit = ing?.unit ?? ''
                      const subtotal = item.quantity * item.unitCost
                      return (
                        <li
                          key={item.id}
                          className="rounded-[var(--radius)] border border-border bg-card p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">{name}</p>
                            <p className="tabular-nums text-sm font-semibold text-foreground">
                              {formatBRL(subtotal)}
                            </p>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="tabular-nums">
                              Quantidade: {formatNumber(item.quantity)} {unit}
                            </span>
                            <span className="tabular-nums">
                              Preço unitário: {formatBRL(item.unitCost)}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma compra selecionada.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
