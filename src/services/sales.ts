import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { mapProduct, mapSale } from '@/lib/pocketbase/maps'
import type { Product, Sale, CartItem, SaleResult } from '@/types'

function toPTBR(error: unknown): Error {
  const raw = getErrorMessage(error)
  if (raw === 'An unexpected error occurred.') {
    return new Error('Ocorreu um erro inesperado. Tente novamente.')
  }
  return new Error(raw)
}

/**
 * Find a single product by its barcode, restricted to active products.
 * Returns the first match or null. Used by the POS barcode scanner.
 */
export async function findProductByBarcode(barcode: string): Promise<Product | null> {
  const code = barcode.trim()
  if (!code) return null
  try {
    const records = await pb.collection('products').getFullList({
      filter: `barcode = "${code}" && active = true`,
    })
    if (records.length === 0) return null
    return mapProduct(records[0])
  } catch (error) {
    throw toPTBR(error)
  }
}

/** List all sales owned by the authenticated user (sorted by date desc). */
export async function listAllSales(): Promise<Sale[]> {
  try {
    const records = await pb.collection('sales').getFullList({
      sort: '-date',
    })
    return records.map((r) => mapSale(r))
  } catch (error) {
    throw toPTBR(error)
  }
}

/**
 * Search active products by name (case-insensitive), limited to 10 results.
 * Used by the POS product search dropdown.
 */
export async function searchActiveProducts(query: string): Promise<Product[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const records = await pb.collection('products').getFullList({
      filter: `active = true && name ~ "${q}"`,
      sort: 'name',
    })
    const mapped = records.map((r) => mapProduct(r))
    const lower = q.toLowerCase()
    return mapped.filter((p) => p.name.toLowerCase().includes(lower)).slice(0, 10)
  } catch (error) {
    throw toPTBR(error)
  }
}

/**
 * List all active products owned by the authenticated user.
 * Used to detect the "no active products" state on the POS page.
 */
export async function listActiveProducts(): Promise<Product[]> {
  try {
    const records = await pb.collection('products').getFullList({
      filter: `active = true`,
      sort: 'name',
    })
    return records.map((r) => mapProduct(r))
  } catch (error) {
    throw toPTBR(error)
  }
}

/**
 * Checkout: creates a `sale` record then each `sale_item` sequentially.
 * The AFTER CREATE hook on sale_items handles stock deduction via the BOM.
 * Returns a SaleResult object suitable for the receipt dialog.
 *
 * @param cart        the cart items to sell
 * @param total       the computed cart total (items total + delivery fee)
 * @param paymentMethod one of "dinheiro" | "cartao" | "pix"
 * @param amountPaid  the cash received (null for non-cash methods)
 * @param change      the change to return (null for non-cash methods)
 * @param deliveryFee the delivery fee charged for this sale (0 if none)
 */
export async function checkoutSale(
  cart: CartItem[],
  total: number,
  paymentMethod: string,
  amountPaid: number | null,
  change: number | null,
  deliveryFee: number,
): Promise<SaleResult> {
  try {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado.')

    const date = new Date().toISOString()
    const safeDeliveryFee = Number.isFinite(deliveryFee) && deliveryFee > 0 ? deliveryFee : 0

    const saleRecord = await pb.collection('sales').create({
      userId,
      total,
      paymentMethod,
      amountPaid: amountPaid ?? 0,
      change: change ?? 0,
      deliveryFee: safeDeliveryFee,
      date,
    })

    const sale = saleRecord as unknown as Sale
    const saleId = sale.id

    for (const item of cart) {
      await pb.collection('sale_items').create({
        userId,
        saleId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
      })
    }

    return {
      saleId,
      total,
      paymentMethod,
      amountPaid,
      change,
      deliveryFee: safeDeliveryFee,
      date,
      items: cart,
    }
  } catch (error) {
    throw toPTBR(error)
  }
}

/** Fetch the set of iFood order ids already imported (for deduplication). */
export async function listImportedIfoodOrderIds(): Promise<Set<string>> {
  try {
    const records = await pb.collection('sales').getFullList({
      filter: `salesChannel = "iFood"`,
      fields: 'ifoodOrderId',
    })
    const set = new Set<string>()
    for (const r of records) {
      const id = (r as { ifoodOrderId?: string | null }).ifoodOrderId
      if (id) set.add(id)
    }
    return set
  } catch (error) {
    throw toPTBR(error)
  }
}

export interface IfoodOrderImportInput {
  total: number
  deliveryFee: number
  ifoodCommission: number
  ifoodOrderId: string
  paymentMethod: string
  date: string
  amountPaid: number
}

/**
 * Create a single iFood sale record (financial data only; no sale_items).
 * The caller is responsible for deduplication and payment-method mapping.
 */
export async function createIfoodSale(input: IfoodOrderImportInput): Promise<string> {
  try {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado.')
    const commission = Number.isFinite(input.ifoodCommission) ? Math.abs(input.ifoodCommission) : 0
    const record = await pb.collection('sales').create({
      userId,
      total: input.total,
      paymentMethod: input.paymentMethod,
      amountPaid: input.amountPaid ?? 0,
      change: 0,
      deliveryFee: Number.isFinite(input.deliveryFee) ? input.deliveryFee : 0,
      date: input.date,
      ifoodCommission: commission,
      ifoodOrderId: input.ifoodOrderId,
      salesChannel: 'iFood',
      isStockAdjustment: false,
    })
    return (record as { id: string }).id
  } catch (error) {
    throw toPTBR(error)
  }
}

export interface IfoodStockItemInput {
  productId: string
  quantity: number
  unitPrice: number
}

/**
 * Create ONE consolidated stock-adjustment sale (zero revenue) and link the
 * given sale_items to it. The existing BOM hook on sale_items creation fires
 * and deducts ingredient stock automatically.
 */
export async function createIfoodStockAdjustment(items: IfoodStockItemInput[]): Promise<string> {
  try {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado.')
    const date = new Date().toISOString()

    const saleRecord = await pb.collection('sales').create({
      userId,
      total: 0,
      paymentMethod: 'dinheiro',
      amountPaid: 0,
      change: 0,
      deliveryFee: 0,
      date,
      ifoodCommission: 0,
      ifoodOrderId: '',
      salesChannel: 'iFood',
      isStockAdjustment: true,
    })
    const saleId = (saleRecord as { id: string }).id

    for (const item of items) {
      await pb.collection('sale_items').create({
        userId,
        saleId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })
    }

    return saleId
  } catch (error) {
    throw toPTBR(error)
  }
}
