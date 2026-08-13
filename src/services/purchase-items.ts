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
