import { useCallback, useState } from 'react'

import { findProductByBarcode as findProductByBarcodeService } from '@/services/sales'
import type { Product } from '@/types'

export interface UseProductLookup {
  /** True while a barcode lookup is in flight. */
  loading: boolean
  /**
   * Find an active product by its barcode.
   * Returns the product or null. Throws a PT-BR Error on network failure.
   */
  findByBarcode: (barcode: string) => Promise<Product | null>
}

/**
 * useProductLookup — thin hook around the barcode lookup service.
 * Scanner input is fast and deterministic, so no debounce is applied.
 */
export function useProductLookup(): UseProductLookup {
  const [loading, setLoading] = useState(false)

  const findByBarcode = useCallback(async (barcode: string): Promise<Product | null> => {
    setLoading(true)
    try {
      return await findProductByBarcodeService(barcode)
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, findByBarcode }
}
