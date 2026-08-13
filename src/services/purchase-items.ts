import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { mapPurchaseItem } from '@/lib/pocketbase/maps'
import type { PurchaseItem, PurchaseItemInput } from '@/types'

function toPTBR(error: unknown): Error {
  const raw = getErrorMessage(error)
  if (raw === 'An unexpected error occurred.') {
    return new Error('Ocorreu um erro inesperado. Tente novamente.')
  }
  return new Error(raw)
}

/** Fetch all purchase_items linked to a given purchase. */
export async function listPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
  try {
    const records = await pb.collection('purchase_items').getFullList({
      filter: `purchaseId = "${purchaseId}"`,
      sort: 'created',
    })
    return records.map((r) => mapPurchaseItem(r))
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Fetch all purchase_items owned by the authenticated user (sorted by created). */
export async function listAllPurchaseItems(): Promise<PurchaseItem[]> {
  try {
    const records = await pb.collection('purchase_items').getFullList({
      sort: 'created',
    })
    return records.map((r) => mapPurchaseItem(r))
  } catch (error) {
    throw toPTBR(error)
  }
}

/**
 * Fetch the most recent purchase_item for a given ingredient (sorted by
 * created descending, limit 1). Returns null if none exists.
 */
export async function getLatestPurchaseItemByIngredient(
  ingredientId: string,
): Promise<PurchaseItem | null> {
  try {
    const records = await pb.collection('purchase_items').getList(1, 1, {
      filter: `ingredientId = "${ingredientId}"`,
      sort: '-created',
    })
    if (records.items.length === 0) return null
    return mapPurchaseItem(records.items[0])
  } catch (error) {
    throw toPTBR(error)
  }
}

/**
 * Fetch the most recent purchase_item for each of a set of ingredients in
 * a batched fashion (avoids N+1 queries). Returns a Map of
 * ingredientId -> PurchaseItem (only ingredients with at least one
 * purchase_item appear in the map).
 */
export async function getLatestPurchaseItemsByIngredients(
  ingredientIds: string[],
): Promise<Map<string, PurchaseItem>> {
  const result = new Map<string, PurchaseItem>()
  if (ingredientIds.length === 0) return result
  try {
    // Fetch all purchase_items for the target ingredients, newest first.
    // PocketBase filters are limited; chunk by 50 OR clauses.
    const chunks: string[][] = []
    for (let i = 0; i < ingredientIds.length; i += 50) {
      chunks.push(ingredientIds.slice(i, i + 50))
    }
    const records = await Promise.all(
      chunks.map((chunk) => {
        const filter = chunk.map((id) => `ingredientId = "${id}"`).join(' || ')
        return pb.collection('purchase_items').getFullList({
          filter,
          sort: '-created',
        })
      }),
    )
    for (const r of records.flat()) {
      const item = mapPurchaseItem(r)
      // Keep only the first (newest) per ingredientId, since results are
      // sorted by -created globally per chunk.
      if (!result.has(item.ingredientId)) {
        result.set(item.ingredientId, item)
      }
    }
    return result
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Create a purchase_item linking an ingredient to a purchase. */
export async function createPurchaseItem(input: PurchaseItemInput): Promise<PurchaseItem> {
  try {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado.')
    const record = await pb.collection('purchase_items').create({
      userId,
      purchaseId: input.purchaseId,
      ingredientId: input.ingredientId,
      quantity: input.quantity,
      unitCost: input.unitCost,
    })
    return mapPurchaseItem(record)
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Delete a purchase_item by id. */
export async function deletePurchaseItem(id: string): Promise<void> {
  try {
    await pb.collection('purchase_items').delete(id)
  } catch (error) {
    throw toPTBR(error)
  }
}
