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
