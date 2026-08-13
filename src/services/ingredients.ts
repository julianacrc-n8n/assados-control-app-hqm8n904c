import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { mapIngredient } from '@/lib/pocketbase/maps'
import type { Ingredient, IngredientInput } from '@/types'

function toPTBR(error: unknown): Error {
  const raw = getErrorMessage(error)
  if (raw === 'An unexpected error occurred.') {
    return new Error('Ocorreu um erro inesperado. Tente novamente.')
  }
  return new Error(raw)
}

/** List all ingredients owned by the authenticated user (sorted by name). */
export async function listIngredients(): Promise<Ingredient[]> {
  try {
    const records = await pb.collection('ingredients').getFullList({
      sort: 'name',
    })
    return records.map((r) => mapIngredient(r))
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Create an ingredient for the authenticated user. */
export async function createIngredient(input: IngredientInput): Promise<Ingredient> {
  try {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado.')
    const record = await pb.collection('ingredients').create({
      userId,
      name: input.name,
      unit: input.unit,
      currentStock: input.currentStock,
      minStock: input.minStock,
    })
    return mapIngredient(record)
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Update an existing ingredient. */
export async function updateIngredient(
  id: string,
  input: Partial<IngredientInput>,
): Promise<Ingredient> {
  try {
    const record = await pb.collection('ingredients').update(id, {
      name: input.name,
      unit: input.unit,
      currentStock: input.currentStock,
      minStock: input.minStock,
    })
    return mapIngredient(record)
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Delete an ingredient by id. */
export async function deleteIngredient(id: string): Promise<void> {
  try {
    await pb.collection('ingredients').delete(id)
  } catch (error) {
    throw toPTBR(error)
  }
}
