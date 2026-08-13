import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { mapPurchase } from '@/lib/pocketbase/maps'
import type { Purchase, PurchaseInput } from '@/types'

function toPTBR(error: unknown): Error {
  const raw = getErrorMessage(error)
  if (raw === 'An unexpected error occurred.') {
    return new Error('Ocorreu um erro inesperado. Tente novamente.')
  }
  return new Error(raw)
}

/** List all purchases owned by the authenticated user (sorted by date desc). */
export async function listPurchases(): Promise<Purchase[]> {
  try {
    const records = await pb.collection('purchases').getFullList({
      sort: '-date',
    })
    return records.map((r) => mapPurchase(r))
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Create a purchase for the authenticated user. */
export async function createPurchase(input: PurchaseInput): Promise<Purchase> {
  try {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado.')
    const record = await pb.collection('purchases').create({
      userId,
      supplier: input.supplier ?? '',
      total: input.total,
      date: input.date,
    })
    return mapPurchase(record)
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Delete a purchase by id. */
export async function deletePurchase(id: string): Promise<void> {
  try {
    await pb.collection('purchases').delete(id)
  } catch (error) {
    throw toPTBR(error)
  }
}
