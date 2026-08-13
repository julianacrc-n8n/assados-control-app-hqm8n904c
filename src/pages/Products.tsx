import { useEffect, useMemo, useState } from 'react'
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
import { PageHeader } from '@/components/PageHeader'
import { DeleteProductDialog } from '@/components/products/DeleteProductDialog'
import { ProductFormSheet } from '@/components/products/ProductFormSheet'
import { useProducts } from '@/hooks/useProducts'
import { useIngredients } from '@/hooks/useIngredients'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Product, RecipeItem } from '@/types'

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  )

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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou código de barras..."
            className="h-11 pl-9"
            aria-label="Buscar produtos"
          />
        </div>
        <Button onClick={openCreate} disabled={loading} className="h-11 md:w-auto">
          <Plus className="h-4 w-4" />
          Cadastrar Produto
        </Button>
      </div>

      {/* Body */}
      <div className="mt-6">
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
            <div className="hidden md:block rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código de Barras</TableHead>
                    <TableHead>Preço de Venda</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
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
                  onEdit={() => openEdit(product)}
                  onDelete={() => setDeleteTarget(product)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  aria-label="Página anterior"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  aria-label="Próxima página"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
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
  onEdit,
  onDelete,
}: {
  product: Product
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <TableRow className={cn('animate-in fade-in-0 duration-300')}>
      <TableCell className="font-medium text-foreground">{product.name}</TableCell>
      <TableCell className="text-muted-foreground">{product.barcode || '—'}</TableCell>
      <TableCell>{formatBRL(product.price)}</TableCell>
      <TableCell>
        <StatusBadge active={product.active} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            aria-label="Editar produto"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-muted-foreground hover:text-destructive"
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
  onEdit,
  onDelete,
}: {
  product: Product
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn('rounded-lg border bg-card p-4 space-y-3 animate-in fade-in-0 duration-300')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {product.barcode || 'Sem código de barras'}
          </p>
        </div>
        <StatusBadge active={product.active} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{formatBRL(product.price)}</span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Editar produto"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 text-muted-foreground hover:text-destructive"
            aria-label="Excluir produto"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? 'border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
          : 'border-transparent bg-muted text-muted-foreground'
      }
    >
      {active ? 'Ativo' : 'Inativo'}
    </Badge>
  )
}

/* ---------------- States ---------------- */

function ProductsTableSkeleton() {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Código de Barras</TableHead>
            <TableHead>Preço de Venda</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-5 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-9 w-9" />
                  <Skeleton className="h-9 w-9" />
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
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 border rounded-lg bg-card border-dashed">
      <Package className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum produto cadastrado</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Cadastre seus produtos para começar a vender.
      </p>
      <Button onClick={onCreate} className="h-11 px-6">
        <Plus className="h-4 w-4" />
        Cadastrar Produto
      </Button>
    </div>
  )
}

function SearchEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-6 border rounded-lg bg-card border-dashed">
      <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum resultado encontrado</h2>
      <p className="text-sm text-muted-foreground max-w-sm">Tente buscar com outro termo.</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-6 border rounded-lg bg-card border-dashed">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-1">Erro ao carregar produtos</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {message || 'Não foi possível carregar seus produtos.'}
      </p>
      <Button onClick={onRetry} variant="outline" className="h-11 px-6">
        Tentar novamente
      </Button>
    </div>
  )
}
