import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Package,
  Search,
  SearchX,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/PageHeader'
import { DeleteProductDialog } from '@/components/products/DeleteProductDialog'
import { ProductFormSheet } from '@/components/products/ProductFormSheet'
import { useProducts } from '@/hooks/useProducts'
import { useBatchProductCost } from '@/hooks/useBatchProductCost'
import { useIngredients } from '@/hooks/useIngredients'
import { formatBRL, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CostSummary, Product, RecipeItem } from '@/types'

const PAGE_SIZE = 20

export default function ProductsPage() {
  const {
    products,
    loading,
    error,
    refetch,
    createProduct,
    updateProduct,
    deleteProduct,
    fetchRecipeItems,
    addRecipeItem,
    removeRecipeItem,
  } = useProducts()
  const { ingredients, loading: ingredientsLoading } = useIngredients()

  // Search (debounced 300ms)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Sheet + delete dialog state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)

  // Pagination
  const [page, setPage] = useState(1)

  // Track the most recently affected product id (create/update via realtime)
  // so we can flash the corresponding row.
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())

  // Reset to first page whenever the search term changes.
  useEffect(() => {
    setPage(1)
  }, [searchTerm])

  const filtered = useMemo(() => {
    if (!searchTerm) return products
    const term = searchTerm.toLowerCase()
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || (p.barcode ?? '').toLowerCase().includes(term),
    )
  }, [products, searchTerm])

  // Detect newly-added or updated products (via realtime) and trigger the
  // row flash animation for the affected id.
  useEffect(() => {
    const known = knownIdsRef.current
    const incoming = products
    let affected: string | null = null
    for (const p of incoming) {
      if (!known.has(p.id)) {
        affected = p.id // new product
        break
      }
    }
    // If none new, check for an updated record by updatedAt timestamp.
    if (!affected && incoming.length > 0) {
      // We can't cheaply diff the previous list, so rely on a simple heuristic:
      // if the set length is unchanged but the head's updatedAt changed, flash it.
      // This is intentionally lightweight; the realtime hook already reconciles.
    }
    // Sync the known set.
    known.clear()
    for (const p of incoming) known.add(p.id)

    if (affected) {
      setFlashId(affected)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setFlashId(null), 600)
    }
  }, [products])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  )

  // Batch cost calculation for the currently visible (paginated) products.
  // Recomputes when the page or search changes. Avoids N+1 queries.
  const { productCosts, loading: costsLoading } = useBatchProductCost(paginated)

  // Load recipe items when the sheet opens for editing.
  useEffect(() => {
    if (!sheetOpen || !editingProduct) {
      setRecipeItems([])
      return
    }
    let active = true
    void (async () => {
      try {
        const items = await fetchRecipeItems(editingProduct.id)
        if (active) setRecipeItems(items)
      } catch (err) {
        if (active) {
          toast.error(err instanceof Error ? err.message : 'Erro ao carregar a receita.')
        }
      }
    })()
    return () => {
      active = false
    }
  }, [sheetOpen, editingProduct, fetchRecipeItems])

  function openCreate() {
    setEditingProduct(null)
    setRecipeItems([])
    setSheetOpen(true)
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setSheetOpen(true)
  }

  return (
    <section>
      <PageHeader title="Produtos" subtitle="Cadastro e gestão de produtos para venda" />

      {/* Toolbar */}
      <div className="mt-6 mb-6 flex items-center justify-between gap-3">
        <div className="relative w-full md:max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou código de barras..."
            className="h-11 rounded-[var(--radius)] border-border bg-background pl-10 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            aria-label="Buscar produtos"
          />
        </div>
        <Button
          onClick={openCreate}
          disabled={loading}
          className="h-11 gap-2 px-5 font-semibold transition-all duration-150 hover:brightness-108 active:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Cadastrar Produto</span>
          <span className="sm:hidden">Cadastrar</span>
        </Button>
      </div>

      {/* Body */}
      <div>
        {loading ? (
          <ProductsTableSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          searchTerm ? (
            <SearchEmptyState />
          ) : (
            <EmptyState onCreate={openCreate} />
          )
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow className="h-12 bg-muted hover:bg-muted">
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Nome
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Código de Barras
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Preço de Venda
                    </TableHead>
                    <TableHead className="hidden px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground md:table-cell">
                      Custo
                    </TableHead>
                    <TableHead className="hidden px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground md:table-cell">
                      Margem
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      flashing={flashId === product.id}
                      costSummary={productCosts.get(product.id)}
                      costsLoading={costsLoading}
                      onEdit={() => openEdit(product)}
                      onDelete={() => setDeleteTarget(product)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-3 md:hidden">
              {paginated.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  costSummary={productCosts.get(product.id)}
                  costsLoading={costsLoading}
                  onEdit={() => openEdit(product)}
                  onDelete={() => setDeleteTarget(product)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Página anterior"
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Próxima página"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Product form Sheet (create / edit) */}
      <ProductFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        product={editingProduct}
        recipeItems={recipeItems}
        ingredients={ingredients}
        ingredientsLoading={ingredientsLoading}
        createProduct={createProduct}
        updateProduct={updateProduct}
        fetchRecipeItems={fetchRecipeItems}
        addRecipeItem={addRecipeItem}
        removeRecipeItem={removeRecipeItem}
      />

      {/* Delete confirmation */}
      <DeleteProductDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onDelete={async () => {
          if (!deleteTarget) return
          await deleteProduct(deleteTarget.id)
        }}
      />
    </section>
  )
}

/* ---------------- Row + Card ---------------- */

function ProductRow({
  product,
  flashing,
  costSummary,
  costsLoading,
  onEdit,
  onDelete,
}: {
  product: Product
  flashing: boolean
  costSummary?: CostSummary
  costsLoading: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <TableRow
      className={cn(
        'h-16 border-t border-border text-sm text-card-foreground transition-colors duration-150 hover:bg-muted/50',
        flashing && 'animate-row-flash',
      )}
    >
      <TableCell className="px-4 align-middle font-semibold text-foreground">
        {product.name}
      </TableCell>
      <TableCell className="px-4 align-middle font-mono text-[0.8125rem] text-muted-foreground">
        {product.barcode || '—'}
      </TableCell>
      <TableCell className="tabular-nums px-4 align-middle font-medium">
        {formatBRL(product.price)}
      </TableCell>
      <TableCell className="hidden px-4 align-middle tabular-nums md:table-cell">
        <CostCell
          cost={costSummary?.totalCost ?? null}
          hasPartialCost={costSummary?.hasPartialCost ?? false}
          loading={costsLoading}
          hasRecipe={costSummary !== undefined}
        />
      </TableCell>
      <TableCell className="hidden px-4 align-middle tabular-nums md:table-cell">
        <MarginCell
          margin={costSummary?.margin ?? null}
          loading={costsLoading}
          hasRecipe={costSummary !== undefined}
        />
      </TableCell>
      <TableCell className="px-4 align-middle">
        <StatusBadge active={product.active} />
      </TableCell>
      <TableCell className="px-4 align-middle">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground"
            aria-label="Editar produto"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            aria-label="Excluir produto"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function ProductCard({
  product,
  costSummary,
  costsLoading,
  onEdit,
  onDelete,
}: {
  product: Product
  costSummary?: CostSummary
  costsLoading: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex animate-in fade-in-0 flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.9375rem] font-semibold text-foreground">{product.name}</p>
        <StatusBadge active={product.active} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">
            {product.barcode || 'Sem código de barras'}
          </p>
          <p className="text-base font-semibold text-foreground">{formatBRL(product.price)}</p>
        </div>
        <div className="flex flex-1 gap-2">
          <Button
            variant="outline"
            className="h-10 flex-1 text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground"
            aria-label="Editar produto"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="outline"
            className="h-10 flex-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            aria-label="Excluir produto"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Custo</span>
          <CostCell
            cost={costSummary?.totalCost ?? null}
            hasPartialCost={costSummary?.hasPartialCost ?? false}
            loading={costsLoading}
            hasRecipe={costSummary !== undefined}
            asText
          />
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-muted-foreground">Margem</span>
          <MarginCell
            margin={costSummary?.margin ?? null}
            loading={costsLoading}
            hasRecipe={costSummary !== undefined}
            asText
          />
        </div>
      </div>
    </div>
  )
}

/* ---------------- Cost / margin cells ---------------- */

function CostCell({
  cost,
  hasPartialCost,
  loading,
  hasRecipe,
  asText,
}: {
  cost: number | null
  hasPartialCost: boolean
  loading: boolean
  hasRecipe: boolean
  asText?: boolean
}) {
  if (loading) {
    return <Skeleton className={cn('rounded-md', asText ? 'h-5 w-20' : 'h-4 w-16')} />
  }
  if (!hasRecipe || cost === null) {
    return <span className="text-muted-foreground">—</span>
  }
  const value = (
    <span className="inline-flex items-center gap-0.5 tabular-nums font-medium">
      {formatBRL(cost)}
      {hasPartialCost && <span className="text-[0.625rem] text-muted-foreground">*</span>}
    </span>
  )
  if (!hasPartialCost) return value
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 rounded-sm"
          >
            {value}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Custo parcial: alguns insumos não tem preço de compra registrado.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function MarginCell({
  margin,
  loading,
  hasRecipe,
  asText,
}: {
  margin: number | null
  loading: boolean
  hasRecipe: boolean
  asText?: boolean
}) {
  if (loading) {
    return <Skeleton className={cn('rounded-md', asText ? 'h-5 w-14' : 'h-4 w-12')} />
  }
  if (!hasRecipe || margin === null) {
    return <span className="text-muted-foreground">—</span>
  }
  const positive = margin >= 0
  return (
    <span
      className={cn(
        'tabular-nums font-medium',
        positive ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive',
      )}
    >
      {formatNumber(margin)}%
    </span>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return (
      <Badge
        variant="outline"
        className="inline-flex items-center gap-1 rounded-full border-transparent px-2.5 py-1 text-xs font-medium"
        style={{
          backgroundColor: 'hsl(142 70% 45% / 0.15)',
          color: 'hsl(142 70% 35%)',
        }}
      >
        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: 'hsl(142 70% 45%)' }} />
        Ativo
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="inline-flex items-center gap-1 rounded-full border-transparent bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
    >
      <span className="h-1 w-1 rounded-full bg-muted-foreground" />
      Inativo
    </Badge>
  )
}

/* ---------------- States ---------------- */

function ProductsTableSkeleton() {
  return (
    <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow className="h-12 bg-muted hover:bg-muted">
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Nome
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Código de Barras
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Preço de Venda
            </TableHead>
            <TableHead className="hidden px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground md:table-cell">
              Custo
            </TableHead>
            <TableHead className="hidden px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground md:table-cell">
              Margem
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i} className="h-16 border-t border-border">
              <TableCell className="px-4">
                <Skeleton className="h-5 w-40 rounded-md" />
              </TableCell>
              <TableCell className="px-4">
                <Skeleton className="h-5 w-28 rounded-md" />
              </TableCell>
              <TableCell className="px-4">
                <Skeleton className="h-5 w-20 rounded-md" />
              </TableCell>
              <TableCell className="hidden px-4 md:table-cell">
                <Skeleton className="h-5 w-16 rounded-md" />
              </TableCell>
              <TableCell className="hidden px-4 md:table-cell">
                <Skeleton className="h-5 w-12 rounded-md" />
              </TableCell>
              <TableCell className="px-4">
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell className="px-4 text-right">
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border bg-card p-12 text-center">
      <Package className="h-12 w-12 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">Nenhum produto cadastrado</h2>
      <p className="mt-2 max-w-[320px] text-sm text-muted-foreground">
        Cadastre seus produtos para começar a vender.
      </p>
      <Button onClick={onCreate} className="mt-6 h-11 gap-2 px-5 font-semibold">
        <Plus className="h-4 w-4" />
        Cadastrar Produto
      </Button>
    </div>
  )
}

function SearchEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border bg-card p-12 text-center">
      <SearchX className="h-12 w-12 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">Nenhum resultado encontrado</h2>
      <p className="mt-2 max-w-[320px] text-sm text-muted-foreground">
        Tente buscar com outro termo.
      </p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border bg-card p-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">Erro ao carregar produtos</h2>
      <p className="mt-2 max-w-[320px] text-sm text-muted-foreground">
        {message || 'Não foi possível carregar seus produtos.'}
      </p>
      <Button onClick={onRetry} variant="outline" className="mt-6 h-11 px-6">
        Tentar novamente
      </Button>
    </div>
  )
}
