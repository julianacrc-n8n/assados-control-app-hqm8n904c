import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChefHat, Loader2, Plus, Trash2 } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
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
    <div className="space-y-4">
      <Separator />

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Receita do Produto</h3>
        <p className="text-sm text-muted-foreground">
          Defina os insumos e quantidades que compõem este produto. Estas quantidades são usadas
          para baixar o estoque automaticamente a cada venda.
        </p>
      </div>

      {noIngredients && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          Você ainda não cadastrou nenhum insumo.{' '}
          <Link to="/purchases" className="font-semibold underline underline-offset-4">
            Acesse a página de Compras para registrar insumos.
          </Link>
        </div>
      )}

      {recipeItems.length === 0 && !noIngredients ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <ChefHat className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">
            Nenhum insumo vinculado a este produto.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Adicione insumos abaixo para definir a receita.
          </p>
        </div>
      ) : null}

      {/* Existing recipe items */}
      {recipeItems.length > 0 && (
        <ul className="space-y-2">
          {recipeItems.map((item) => {
            const ing = ingredientById.get(item.ingredientId)
            const unit = ing?.unit ?? ''
            const name = ing?.name ?? 'Insumo removido'
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(item.quantity)} {unit}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
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
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-ingredient">
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="recipe-quantity">
                Quantidade
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="recipe-quantity"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  placeholder="Quantidade"
                  className="h-11 w-28"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={adding || availableIngredients.length === 0}
                />
                <span className="w-16 text-sm text-muted-foreground">
                  {selectedIngredient?.unit ?? ''}
                </span>
              </div>
            </div>

            <Button
              type="button"
              className="h-11"
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
