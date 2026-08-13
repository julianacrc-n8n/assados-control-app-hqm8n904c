import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { RecipeEditor } from '@/components/products/RecipeEditor'
import type { Ingredient, Product, RecipeItem } from '@/types'

interface ProductFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The product being edited, or null in create mode. */
  product: Product | null
  /** Existing recipe items for the edited product (empty in create mode). */
  recipeItems: RecipeItem[]
  ingredients: Ingredient[]
  ingredientsLoading: boolean
  createProduct: (input: {
    name: string
    barcode: string | null
    price: number
    description: string | null
    active: boolean
  }) => Promise<Product>
  updateProduct: (
    id: string,
    input: {
      name: string
      barcode: string | null
      price: number
      description: string | null
      active: boolean
    },
  ) => Promise<Product>
  fetchRecipeItems: (productId: string) => Promise<RecipeItem[]>
  addRecipeItem: (input: {
    productId: string
    ingredientId: string
    quantity: number
  }) => Promise<RecipeItem>
  removeRecipeItem: (id: string) => Promise<void>
}

interface FormState {
  name: string
  barcode: string
  price: string
  description: string
  active: boolean
}

function emptyForm(): FormState {
  return { name: '', barcode: '', price: '', description: '', active: true }
}

function fromProduct(p: Product): FormState {
  return {
    name: p.name,
    barcode: p.barcode ?? '',
    price: String(p.price),
    description: p.description ?? '',
    active: p.active,
  }
}

/**
 * Product form Sheet — create or edit a product. In edit mode, also renders
 * the Recipe / BOM editor below the form fields.
 */
export function ProductFormSheet({
  open,
  onOpenChange,
  product,
  recipeItems,
  ingredients,
  ingredientsLoading,
  createProduct,
  updateProduct,
  fetchRecipeItems,
  addRecipeItem,
  removeRecipeItem,
}: ProductFormSheetProps) {
  const isEdit = product !== null
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({})
  const [saving, setSaving] = useState(false)

  // Sync form state whenever the sheet opens / target product changes.
  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(product ? fromProduct(product) : emptyForm())
  }, [open, product])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'name' && errors.name) setErrors((e) => ({ ...e, name: undefined }))
    if (key === 'price' && errors.price) setErrors((e) => ({ ...e, price: undefined }))
  }

  function validate(): boolean {
    const next: { name?: string; price?: string } = {}
    if (!form.name.trim()) next.name = 'O nome é obrigatório.'
    const priceNum = parseFloat(form.price.replace(',', '.'))
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      next.price = 'O preço deve ser maior ou igual a zero.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    const payload = {
      name: form.name.trim().slice(0, 200),
      barcode: form.barcode.trim().slice(0, 100) || null,
      price: parseFloat(form.price.replace(',', '.')),
      description: form.description.trim().slice(0, 500) || null,
      active: form.active,
    }
    try {
      if (isEdit && product) {
        await updateProduct(product.id, payload)
        toast.success('Produto atualizado com sucesso.')
      } else {
        await createProduct(payload)
        toast.success('Produto cadastrado com sucesso.')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produto.')
    } finally {
      setSaving(false)
    }
  }

  const title = useMemo(() => (isEdit ? 'Editar Produto' : 'Cadastrar Produto'), [isEdit])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Edite as informações do produto e sua receita.'
              : 'Preencha as informações do novo produto.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="product-name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="product-name"
              value={form.name}
              maxLength={200}
              placeholder="Ex: Pão Francês"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'product-name-error' : undefined}
              disabled={saving}
              onChange={(e) => set('name', e.target.value)}
            />
            {errors.name && (
              <p id="product-name-error" className="text-xs text-destructive">
                {errors.name}
              </p>
            )}
          </div>

          {/* Barcode */}
          <div className="space-y-1.5">
            <Label htmlFor="product-barcode">Código de Barras</Label>
            <Input
              id="product-barcode"
              value={form.barcode}
              maxLength={100}
              placeholder="Ex: 7891234567890"
              disabled={saving}
              onChange={(e) => set('barcode', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use o leitor de barras para preencher ou digite manualmente.
            </p>
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label htmlFor="product-price">
              Preço de Venda (R$) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="product-price"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              placeholder="0,00"
              value={form.price}
              aria-invalid={!!errors.price}
              aria-describedby={errors.price ? 'product-price-error' : undefined}
              disabled={saving}
              onChange={(e) => set('price', e.target.value)}
            />
            {errors.price && (
              <p id="product-price-error" className="text-xs text-destructive">
                {errors.price}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="product-description">Descrição</Label>
            <Textarea
              id="product-description"
              value={form.description}
              maxLength={500}
              placeholder="Ex: Pão crocante feito com fermentação natural."
              disabled={saving}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {/* Active */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="product-active" className="cursor-pointer">
                Produto ativo
              </Label>
              <p className="text-xs text-muted-foreground">
                Produtos inativos não aparecem no PDV.
              </p>
            </div>
            <Switch
              id="product-active"
              checked={form.active}
              onCheckedChange={(v) => set('active', v)}
              disabled={saving}
            />
          </div>

          {/* Recipe editor — only in edit mode */}
          {isEdit && product && (
            <RecipeEditor
              productId={product.id}
              recipeItems={recipeItems}
              ingredients={ingredients}
              ingredientsLoading={ingredientsLoading}
              fetchRecipeItems={fetchRecipeItems}
              addRecipeItem={addRecipeItem}
              removeRecipeItem={removeRecipeItem}
            />
          )}

          <SheetFooter className="flex-row gap-2 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="h-11" disabled={saving}>
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
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
