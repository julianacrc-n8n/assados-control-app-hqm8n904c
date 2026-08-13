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

/** Sale record owned by the authenticated user. */
export interface Sale {
  id: string
  userId: string
  total: number
  paymentMethod: string
  amountPaid: number | null
  change: number | null
  date: string
  createdAt: string
  updatedAt: string
}

/** A line item of a sale. */
export interface SaleItem {
  id: string
  userId: string
  saleId: string
  productId: string
  quantity: number
  unitPrice: number
  createdAt: string
}

/** A product in the POS cart. `subtotal` is `price * quantity`. */
export interface CartItem {
  productId: string
  name: string
  barcode: string | null
  price: number
  quantity: number
  subtotal: number
}

/** The result of a successful checkout, used to render the receipt. */
export interface SaleResult {
  saleId: string
  total: number
  paymentMethod: string
  amountPaid: number | null
  change: number | null
  date: string
  items: CartItem[]
}

/** A single data point for a revenue/expenses time-series chart. */
export interface DailyPoint {
  date: string
  value: number
}

/** A product ranked by sales quantity within a reporting period. */
export interface TopProduct {
  productName: string
  quantitySold: number
  totalRevenue: number
}

/** Revenue split by payment method for a reporting period. */
export interface PaymentBreakdown {
  dinheiro: number
  cartao: number
  pix: number
}

/** Aggregated metrics computed by the useReports hook for a date range. */
export interface ReportData {
  totalRevenue: number
  totalExpenses: number
  totalProfit: number
  salesCount: number
  purchasesCount: number
  averageTicket: number
  dailyRevenue: DailyPoint[]
  dailyExpenses: DailyPoint[]
  topProducts: TopProduct[]
  paymentBreakdown: PaymentBreakdown
}

/** Aggregated metrics shown on the Dashboard page. */
export interface DashboardMetrics {
  totalRevenue: number
  totalExpenses: number
  totalProfit: number
  todaySales: number
  todaySalesCount: number
  monthExpenses: number
  monthExpensesCount: number
  lowStockIngredients: Ingredient[]
  totalProducts: number
  activeProducts: number
}

/**
 * A single line of a product's production cost breakdown — one per
 * recipe_item, enriched with the latest known unit cost for that ingredient.
 */
export interface CostLine {
  ingredientId: string
  ingredientName: string
  unit: string
  quantity: number
  unitCost: number | null
  lineCost: number | null
}

/** Aggregated cost summary for a product, used in the products table. */
export interface CostSummary {
  productId: string
  totalCost: number | null
  margin: number | null
  /**
   * True when the product has a recipe and at least one ingredient has a
   * known cost but at least one other does not (partial cost). Used to show
   * the asterisk + tooltip in the products table.
   */
  hasPartialCost?: boolean
}
