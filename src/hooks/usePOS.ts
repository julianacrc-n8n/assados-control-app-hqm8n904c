import { useCallback, useMemo, useRef, useState } from 'react'

import pb from '@/lib/pocketbase/client'
import { checkoutSale } from '@/services/sales'
import { mapIngredient } from '@/lib/pocketbase/maps'
import type { CartItem, SaleResult, Ingredient } from '@/types'

export interface UsePOS {
  cart: CartItem[]
  cartTotal: number
  itemCount: number
  lastSale: SaleResult | null
  lowStockWarnings: string[]
  checkingOut: boolean
  addToCart: (item: Omit<CartItem, 'quantity' | 'subtotal'>) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  checkout: (params: {
    paymentMethod: string
    amountPaid: number | null
    change: number | null
    deliveryFee: number
  }) => Promise<SaleResult>
}

/**
 * usePOS — manages the entire POS sale flow (transactional, no realtime).
 * All async operations are wrapped in try/catch and throw user-friendly
 * PT-BR Error instances on failure.
 */
export function usePOS(): UsePOS {
  const [cart, setCart] = useState<CartItem[]>([])
  const [lastSale, setLastSale] = useState<SaleResult | null>(null)
  const [lowStockWarnings, setLowStockWarnings] = useState<string[]>([])
  const [checkingOut, setCheckingOut] = useState(false)
  const cartRef = useRef<CartItem[]>([])
  cartRef.current = cart

  const addToCart = useCallback((item: Omit<CartItem, 'quantity' | 'subtotal'>) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.productId === item.productId)
      if (idx === -1) {
        return [...prev, { ...item, quantity: 1, subtotal: item.price * 1 }]
      }
      const next = prev.slice()
      const existing = next[idx]
      const updated = { ...existing, quantity: existing.quantity + 1 }
      updated.subtotal = updated.price * updated.quantity
      next[idx] = updated
      return next
    })
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId))
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) return
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.productId === productId)
      if (idx === -1) return prev
      const next = prev.slice()
      const updated = { ...next[idx], quantity }
      updated.subtotal = updated.price * updated.quantity
      next[idx] = updated
      return next
    })
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart])

  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])

  /**
   * After a successful checkout, query the ingredients collection for any
   * ingredient whose currentStock is at or below its minStock (and minStock > 0).
   * The AFTER CREATE hook on sale_items handles the actual deduction.
   */
  const refreshLowStock = useCallback(async (): Promise<string[]> => {
    try {
      const records = await pb.collection('ingredients').getFullList({
        filter: 'minStock > 0 && currentStock <= minStock',
      })
      const ingredients = records.map((r) => mapIngredient(r)) as Ingredient[]
      return ingredients.map((i) => i.name)
    } catch {
      return []
    }
  }, [])

  const checkout = useCallback(
    async (params: {
      paymentMethod: string
      amountPaid: number | null
      change: number | null
      deliveryFee: number
    }): Promise<SaleResult> => {
      const currentCart = cartRef.current
      if (currentCart.length === 0) {
        throw new Error('O carrinho está vazio.')
      }
      setCheckingOut(true)
      try {
        const itemsTotal = currentCart.reduce((sum, item) => sum + item.subtotal, 0)
        const safeDeliveryFee =
          Number.isFinite(params.deliveryFee) && params.deliveryFee > 0 ? params.deliveryFee : 0
        const grandTotal = itemsTotal + safeDeliveryFee
        const result = await checkoutSale(
          currentCart,
          grandTotal,
          params.paymentMethod,
          params.amountPaid,
          params.change,
          safeDeliveryFee,
        )
        setLastSale(result)
        setCart([])
        const warnings = await refreshLowStock()
        setLowStockWarnings(warnings)
        return result
      } catch (error) {
        if (error instanceof Error) throw error
        throw new Error('Não foi possível finalizar a venda. Tente novamente.')
      } finally {
        setCheckingOut(false)
      }
    },
    [refreshLowStock],
  )

  return {
    cart,
    cartTotal,
    itemCount,
    lastSale,
    lowStockWarnings,
    checkingOut,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    checkout,
  }
}
