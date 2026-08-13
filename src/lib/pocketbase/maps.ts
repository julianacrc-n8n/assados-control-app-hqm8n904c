/**
 * Maps a PocketBase record (which uses `created`/`updated` system fields and
 * relation fields stored as id strings) to our camelCase domain types.
 *
 * The SDK returns plain objects with the same keys as the collection fields,
 * so mapping is a matter of aliasing `created` -> `createdAt`, `updated` ->
 * `updatedAt` and resolving relation fields to their id string.
 */

import type { Product, RecipeItem, Ingredient, IngredientUnit } from '@/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

function str(v: any, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function strOrNull(v: any): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'string') return v
  // relation fields may come back as an id string or as an expanded record
  if (typeof v === 'object' && typeof v.id === 'string') return v.id
  return null
}

function num(v: any, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

function bool(v: any, fallback = false): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v === 'true' || v === '1'
  return fallback
}

function date(v: any, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

export function mapProduct(r: any): Product {
  return {
    id: str(r.id),
    userId: str(r.userId),
    name: str(r.name),
    barcode: strOrNull(r.barcode),
    price: num(r.price),
    description: strOrNull(r.description),
    active: bool(r.active),
    createdAt: date(r.created),
    updatedAt: date(r.updated),
  }
}

export function mapIngredient(r: any): Ingredient {
  return {
    id: str(r.id),
    userId: str(r.userId),
    name: str(r.name),
    unit: (str(r.unit) || 'unidade') as IngredientUnit,
    currentStock: num(r.currentStock),
    minStock: num(r.minStock),
    createdAt: date(r.created),
    updatedAt: date(r.updated),
  }
}

export function mapRecipeItem(r: any): RecipeItem {
  return {
    id: str(r.id),
    userId: str(r.userId),
    productId: str(r.productId),
    ingredientId: str(r.ingredientId),
    quantity: num(r.quantity),
    createdAt: date(r.created),
  }
}
