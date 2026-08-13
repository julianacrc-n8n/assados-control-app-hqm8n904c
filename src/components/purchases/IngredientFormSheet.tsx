import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Loader2 } from 'lucide-react'

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
import type { Ingredient, IngredientInput, IngredientUnit } from '@/types'

const UNIT_OPTIONS: IngredientUnit[] = ['kg', 'g', 'L', 'mL', 'unidade']

interface IngredientFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredient: Ingredient | null
  createIngredient: (input: IngredientInput) => Promise<Ingredient>
  updateIngredient: (id: string, input: Partial<IngredientInput>) => Promise<Ingredient>
}

interface FormState {
  name: string
  unit: IngredientUnit
  currentStock: string
  minStock: string
}

function emptyForm(): FormState {
  return { name: '', unit: 'kg', currentStock: '0', minStock: '0' }
}

function fromIngredient(i: Ingredient): FormState {
  return {
    name: i.name,
    unit: i.unit,
    currentStock: String(i.currentStock),
    minStock: String(i.minStock),
  }
}

/** Parse a decimal string that may use comma or dot as separator. */
function parseNum(value: string): number {
  const n = parseFloat(value.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export function IngredientFormSheet({
  open,
  onOpenChange,
  ingredient,
  createIngredient,
  updateIngredient,
}: IngredientFormSheetProps) {
  const isEdit = ingredient !== null
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<{ name?: string; unit?: string }>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(ingredient ? fromIngredient(ingredient) : emptyForm())
  }, [open, ingredient])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'name' && errors.name) setErrors((e) => ({ ...e, name: undefined }))
    if (key === 'unit' && errors.unit) setErrors((e) => ({ ...e, unit: undefined }))
  }

  function validate(): boolean {
    const next: { name?: string; unit?: string } = {}
    if (!form.name.trim()) next.name = 'O nome é obrigatório.'
    if (!form.unit) next.unit = 'Selecione uma unidade.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    const payload: IngredientInput = {
      name: form.name.trim().slice(0, 200),
      unit: form.unit,
      currentStock: Math.max(0, parseNum(form.currentStock) || 0),
      minStock: Math.max(0, parseNum(form.minStock) || 0),
    }
    try {
      if (isEdit && ingredient) {
        await updateIngredient(ingredient.id, payload)
        toast.success('Insumo atualizado com sucesso.')
      } else {
        await createIngredient(payload)
        toast.success('Insumo cadastrado com sucesso.')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar insumo.')
    } finally {
      setSaving(false)
    }
  }

  const title = useMemo(() => (isEdit ? 'Editar Insumo' : 'Cadastrar Insumo'), [isEdit])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        <SheetHeader className="flex flex-col space-y-0 border-b border-border p-6">
          <SheetTitle className="text-lg font-bold">{title}</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            {isEdit ? 'Edite as informações do insumo.' : 'Preencha as informações do novo insumo.'}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6"
          style={{ maxHeight: 'calc(100vh - 8rem)' }}
        >
          {/* Name */}
          <div className="mb-5">
            <Label
              htmlFor="ingredient-name"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ingredient-name"
              value={form.name}
              maxLength={200}
              placeholder="Ex: Frango"
              className="h-11 rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'ingredient-name-error' : undefined}
              disabled={saving}
              onChange={(e) => set('name', e.target.value)}
            />
            {errors.name && (
              <p
                id="ingredient-name-error"
                className="mt-1.5 flex items-center gap-1 text-xs text-destructive"
              >
                <AlertCircle className="h-3 w-3" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Unit */}
          <div className="mb-5">
            <Label
              htmlFor="ingredient-unit"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Unidade de Medida <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.unit}
              onValueChange={(v) => set('unit', v as IngredientUnit)}
              disabled={saving}
            >
              <SelectTrigger
                id="ingredient-unit"
                className="h-11 rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
                aria-invalid={!!errors.unit}
                aria-describedby={errors.unit ? 'ingredient-unit-error' : undefined}
              >
                <SelectValue placeholder="Selecione uma unidade" />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.unit && (
              <p
                id="ingredient-unit-error"
                className="mt-1.5 flex items-center gap-1 text-xs text-destructive"
              >
                <AlertCircle className="h-3 w-3" />
                {errors.unit}
              </p>
            )}
          </div>

          {/* Current stock */}
          <div className="mb-5">
            <Label
              htmlFor="ingredient-current-stock"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Estoque Atual <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ingredient-current-stock"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={form.currentStock}
              className="h-11 rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
              disabled={saving}
              onChange={(e) => set('currentStock', e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Quantidade atual em estoque. Será atualizada automaticamente ao registrar compras e
              vendas.
            </p>
          </div>

          {/* Min stock */}
          <div className="mb-5">
            <Label
              htmlFor="ingredient-min-stock"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Estoque Mínimo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ingredient-min-stock"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={form.minStock}
              className="h-11 rounded-[var(--radius)] border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
              disabled={saving}
              onChange={(e) => set('minStock', e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Quando o estoque atingir este valor, o sistema emitirá um alerta.
            </p>
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
            <Button type="submit" className="h-11 px-6" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : isEdit ? (
                'Salvar Alterações'
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
