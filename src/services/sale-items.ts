import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { SaleItem } from '@/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

function toPTBR(error: unknown): Error {
  const raw = getErrorMessage(error)
  if (raw === 'An unexpected error occurred.') {
    return new Error('Ocorreu um erro inesperado. Tente novamente.')
  }
  return new Error(raw)
}

function mapSaleItem(r: any): SaleItem {
  return {
    id: typeof r.id === 'string' ? r.id : '',
    userId: typeof r.userId === 'string' ? r.userId : '',
    saleId: typeof r.saleId === 'string' ? r.saleId : '',
    productId: typeof r.productId === 'string' ? r.productId : '',
    quantity: typeof r.quantity === 'number' ? r.quantity : parseFloat(r.quantity) || 0,
    unitPrice: typeof r.unitPrice === 'number' ? r.unitPrice : parseFloat(r.unitPrice) || 0,
    createdAt: typeof r.created === 'string' ? r.created : '',
  }
}

/** Fetch all sale_items owned by the authenticated user (sorted by created). */
export async function listAllSaleItems(): Promise<SaleItem[]> {
  try {
    const records = await pb.collection('sale_items').getFullList({
      sort: 'created',
    })
    return records.map((r) => mapSaleItem(r))
  } catch (error) {
    throw toPTBR(error)
  }
}

/**
 * Fetch all sale_items linked to any of the given sale ids.
 * Uses an OR filter over the relation field. Returns an empty array when no
 * sale ids are provided.
 */
export async function listSaleItemsForSales(saleIds: string[]): Promise<SaleItem[]> {
  if (saleIds.length === 0) return []
  try {
    const filter = saleIds.map((id) => `saleId = "${id}"`).join(' || ')
    const records = await pb.collection('sale_items').getFullList({
      filter,
      sort: 'created',
    })
    return records.map((r) => mapSaleItem(r))
  } catch (error) {
    throw toPTBR(error)
  }
}
