import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { mapIngredient } from '@/lib/pocketbase/maps'
import type { Ingredient } from '@/types'

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
