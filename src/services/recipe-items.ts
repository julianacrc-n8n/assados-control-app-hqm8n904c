import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { mapRecipeItem } from '@/lib/pocketbase/maps'
import type { RecipeItem, RecipeItemInput } from '@/types'

function toPTBR(error: unknown): Error {
  const raw = getErrorMessage(error)
  if (raw === 'An unexpected error occurred.') {
    return new Error('Ocorreu um erro inesperado. Tente novamente.')
  }
  return new Error(raw)
}

/** Fetch all recipe_items linked to a given product. */
export async function listRecipeItems(productId: string): Promise<RecipeItem[]> {
  try {
    const records = await pb.collection('recipe_items').getFullList({
      filter: `productId = "${productId}"`,
      sort: 'created',
    })
    return records.map((r) => mapRecipeItem(r))
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Create a recipe_item linking an ingredient to a product. */
export async function createRecipeItem(input: RecipeItemInput): Promise<RecipeItem> {
  try {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado.')
    const record = await pb.collection('recipe_items').create({
      userId,
      productId: input.productId,
      ingredientId: input.ingredientId,
      quantity: input.quantity,
    })
    return mapRecipeItem(record)
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Delete a recipe_item by id. */
export async function deleteRecipeItem(id: string): Promise<void> {
  try {
    await pb.collection('recipe_items').delete(id)
  } catch (error) {
    throw toPTBR(error)
  }
}
