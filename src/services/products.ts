import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { mapProduct } from '@/lib/pocketbase/maps'
import type { Product, ProductInput } from '@/types'

/**
 * Products service — thin wrapper around the PocketBase SDK for the
 * `products` collection. All public functions throw user-friendly PT-BR
 * Error instances on failure (never raw ClientResponseError).
 */

function toPTBR(error: unknown): Error {
  const raw = getErrorMessage(error)
  // getErrorMessage already returns a joined string of field messages or a
  // generic english fallback. Map the generic fallbacks to PT-BR.
  if (raw === 'An unexpected error occurred.') {
    return new Error('Ocorreu um erro inesperado. Tente novamente.')
  }
  return new Error(raw)
}

/** List all products owned by the authenticated user (sorted by created desc). */
export async function listProducts(): Promise<Product[]> {
  try {
    const records = await pb.collection('products').getFullList({
      sort: '-created',
    })
    return records.map((r) => mapProduct(r))
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Create a product for the authenticated user. */
export async function createProduct(input: ProductInput): Promise<Product> {
  try {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado.')
    const record = await pb.collection('products').create({
      userId,
      name: input.name,
      barcode: input.barcode ?? '',
      price: input.price,
      description: input.description ?? '',
      active: input.active,
    })
    return mapProduct(record)
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Update an existing product. */
export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  try {
    const record = await pb.collection('products').update(id, {
      name: input.name,
      barcode: input.barcode,
      price: input.price,
      description: input.description,
      active: input.active,
    })
    return mapProduct(record)
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Delete a product by id. */
export async function deleteProduct(id: string): Promise<void> {
  try {
    await pb.collection('products').delete(id)
  } catch (error) {
    throw toPTBR(error)
  }
}
