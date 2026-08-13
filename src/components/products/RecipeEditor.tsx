import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ChefHat, Loader2, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatNumber } from '@/lib/format'
import type { Ingredient, RecipeItem } from '@/types'

interface RecipeEditorProps {
  productId: string
  recipeItems: RecipeItem[]
  ingredients: Ingredient[]
  ingredientsLoading: boolean
  fetchRecipeItems: (productId: string) => Promise<RecipeItem[]>
  addRecipeItem: (input: {
    productId: string
    ingredientId: string
    quantity: number
  }) => Promise<RecipeItem>
  removeRecipeItem: (id: string) => Promise<void>
}

/**
 * Recipe / BOM editor shown inside the edit Sheet. Lets the user link
 * ingredients to a product with quantities.
 */
export function RecipeEditor({
  productId,
  recipeItems,
  ingredients,
  ingredientsLoading,
  fetchRecipeItems,
  addRecipeItem,
  removeRecipeItem,
}: RecipeEditorProps) {
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Ingredients not yet linked to this product (available in the dropdown).
  const linkedIngredientIds = useMemo(
    () => new Set(recipeItems.map((r) => r.ingredientId)),
    [recipeItems],
  )

  const availableIngredients = useMemo(
    () => ingredients.filter((i) => !linkedIngredientIds.has(i.id)),
    [ingredients, linkedIngredientIds],
  )

  const selectedIngredient = useMemo(
    () => ingredients.find((i) => i.id === selectedIngredientId) ?? null,
    [ingredients, selectedIngredientId],
  )

  // Resolve an ingredient name/unit for an existing recipe item.
  const ingredientById = useMemo(() => {
    const map = new Map<string, Ingredient>()
    for (const i of ingredients) map.set(i.id, i)
    return map
  }, [ingredients])

  const numQuantity = parseFloat(quantity.replace(',', '.'))
  const canAdd =
    selectedIngredientId !== '' && Number.isFinite(numQuantity) && numQuantity > 0 && !adding

  async function handleAdd() {
    if (!selectedIngredientId || !canAdd) return
    setAdding(true)
    try {
      await addRecipeItem({
        productId,
        ingredientId: selectedIngredientId,
        quantity: numQuantity,
      })
      toast.success('Insumo adicionado à receita.')
      setSelectedIngredientId('')
      setQuantity('')
      await fetchRecipeItems(productId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar insumo.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = useCallback(
    async (id: string) => {
      setRemovingId(id)
      try {
        await removeRecipeItem(id)
        toast.success('Insumo removido da receita.')
        await fetchRecipeItems(productId)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao remover insumo.')
      } finally {
        setRemovingId(null)
      }
    },
    [removeRecipeItem, fetchRecipeItems, productId],
  )

  // Reset the selected ingredient if it becomes linked (e.g. after an add).
  useEffect(() => {
    if (selectedIngredientId && linkedIngredientIds.has(selectedIngredientId)) {
      setSelectedIngredientId('')
    }
  }, [linkedIngredientIds, selectedIngredientId])

  const noIngredients = ingredients.length === 0 && !ingredientsLoading

  return (
    <div>
      <div className="mt-6 border-t border-border" />

      <div className="mb-4 mt-6">
        <h3 className="text-base font-bold text-foreground">Receita do Produto</h3>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          Defina os insumos e quantidades que compõem este produto. Estas quantidades são usadas
          para baixar o estoque automaticamente a cada venda.
        </p>
      </div>

      {noIngredients && (
        <div
          className="mb-4 flex items-center gap-2 rounded-[var(--radius)] px-4 py-3"
          style={{
            backgroundColor: 'hsl(var(--destructive) / 0.1)',
            border: '1px solid hsl(var(--destructive) / 0.3)',
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-[0.8125rem] text-foreground">
            Você ainda não cadastrou nenhum insumo.{' '}
            <Link
              to="/purchases"
              className="font-medium text-accent-foreground underline underline-offset-4"
            >
              Acesse a página de Compras para registrar insumos.
            </Link>
          </p>
        </div>
      )}

      {recipeItems.length === 0 && !noIngredients ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border p-6 text-center">
          <ChefHat className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Nenhum insumo vinculado a este produto.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Adicione insumos abaixo para definir a receita.
          </p>
        </div>
      ) : null}

      {/* Existing recipe items */}
      {recipeItems.length > 0 && (
        <ul className="space-y-0">
          {recipeItems.map((item) => {
            const ing = ingredientById.get(item.ingredientId)
            const unit = ing?.unit ?? ''
            const name = ing?.name ?? 'Insumo removido'
            return (
              <li
                key={item.id}
                className="mb-2 flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                  <p className="tabular-nums text-sm text-muted-foreground">
                    {formatNumber(item.quantity)} {unit}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                  aria-label="Remover insumo"
                  disabled={removingId === item.id}
                  onClick={() => void handleRemove(item.id)}
                >
                  {removingId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Add row */}
      {!noIngredients && (
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end">
          <div className="flex-1">
            <label
              className="mb-2 block text-sm font-medium text-foreground"
              htmlFor="recipe-ingredient"
            >
              Insumo
            </label>
            {availableIngredients.length === 0 ? (
              <Select disabled>
                <SelectTrigger id="recipe-ingredient" className="h-11">
                  <SelectValue placeholder="Todos os insumos já estão vinculados." />
                </SelectTrigger>
                <SelectContent />
              </Select>
            ) : (
              <Select value={selectedIngredientId} onValueChange={setSelectedIngredientId}>
                <SelectTrigger id="recipe-ingredient" className="h-11">
                  <SelectValue placeholder="Selecione um insumo" />
                </SelectTrigger>
                <SelectContent>
                  {availableIngredients.map((ing) => (
                    <SelectItem key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-end gap-2">
            <div className="w-full md:w-[120px]">
              <label
                className="mb-2 block text-sm font-medium text-foreground"
                htmlFor="recipe-quantity"
              >
                Quantidade
              </label>
              <Input
                id="recipe-quantity"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                placeholder="Quantidade"
                className="h-11 w-full"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={adding || availableIngredients.length === 0}
              />
            </div>

            <span className="pb-2.5 text-sm text-muted-foreground">
              {selectedIngredient?.unit ?? ''}
            </span>

            <Button
              type="button"
              className="h-11 px-4"
              disabled={!canAdd}
              onClick={() => void handleAdd()}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
