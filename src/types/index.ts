/**
 * Shared domain types for the Assados Control app.
 * Field names mirror the PocketBase collection schema exactly
 * (camelCase) so that records returned from the SDK can be used directly.
 */

export interface Product {
  id: string
  userId: string
  name: string
  barcode: string | null
  price: number
  description: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type IngredientUnit = 'kg' | 'g' | 'L' | 'mL' | 'unidade'

export interface Ingredient {
  id: string
  userId: string
  name: string
  unit: IngredientUnit
  currentStock: number
  minStock: number
  createdAt: string
  updatedAt: string
}

export interface RecipeItem {
  id: string
  userId: string
  productId: string
  ingredientId: string
  quantity: number
  createdAt: string
}

export interface Purchase {
  id: string
  userId: string
  supplier: string | null
  total: number
  date: string
  createdAt: string
}

export interface PurchaseItem {
  id: string
  userId: string
  purchaseId: string
  ingredientId: string
  quantity: number
  unitCost: number
  createdAt: string
}

/** Payload used when creating a product (server fills the rest). */
export interface ProductInput {
  name: string
  barcode: string | null
  price: number
  description: string | null
  active: boolean
}

/** Payload used when creating a recipe_item (server fills the rest). */
export interface RecipeItemInput {
  productId: string
  ingredientId: string
  quantity: number
}

/** Payload used when creating/updating an ingredient. */
export interface IngredientInput {
  name: string
  unit: IngredientUnit
  currentStock: number
  minStock: number
}

/** Payload used when creating a purchase (server fills the rest). */
export interface PurchaseInput {
  supplier: string | null
  total: number
  date: string
}

/** Payload used when creating a purchase_item (server fills the rest). */
export interface PurchaseItemInput {
  purchaseId: string
  ingredientId: string
  quantity: number
  unitCost: number
}
