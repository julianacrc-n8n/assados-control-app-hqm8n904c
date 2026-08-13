import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  Pencil,
  Plus,
  Search,
  SearchX,
  ShoppingCart,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/PageHeader'
import { DeleteIngredientDialog } from '@/components/purchases/DeleteIngredientDialog'
import { DeletePurchaseDialog } from '@/components/purchases/DeletePurchaseDialog'
import { IngredientFormSheet } from '@/components/purchases/IngredientFormSheet'
import { PurchaseDetailSheet } from '@/components/purchases/PurchaseDetailSheet'
import { PurchaseFormSheet } from '@/components/purchases/PurchaseFormSheet'
import { useIngredients } from '@/hooks/useIngredients'
import { usePurchases } from '@/hooks/usePurchases'
import { listAllPurchaseItems } from '@/services/purchase-items'
import { formatBRL, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Ingredient, Purchase, PurchaseItem } from '@/types'

const PAGE_SIZE = 20

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export default function PurchasesPage() {
  const [tab, setTab] = useState<'ingredients' | 'purchases'>('ingredients')

  const {
    ingredients,
    loading: ingredientsLoading,
    error: ingredientsError,
    refetch: refetchIngredients,
    createIngredient,
    updateIngredient,
    deleteIngredient,
  } = useIngredients()

  const {
    purchases,
    purchaseItems,
    loading: purchasesLoading,
    error: purchasesError,
    refetch: refetchPurchases,
    createPurchase,
    deletePurchase,
    fetchPurchaseDetails,
  } = usePurchases()

  return (
    <section>
      <PageHeader title="Compras" subtitle="Registro de compras de insumos e matéria-prima" />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'ingredients' | 'purchases')}
        className="mt-6"
      >
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-none sm:inline-flex">
          <TabsTrigger value="ingredients" className="h-11">
            Insumos
          </TabsTrigger>
          <TabsTrigger value="purchases" className="h-11">
            Compras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ingredients" className="mt-6">
          <IngredientsTab
            ingredients={ingredients}
            loading={ingredientsLoading}
            error={ingredientsError}
            refetch={refetchIngredients}
            createIngredient={createIngredient}
            updateIngredient={updateIngredient}
            deleteIngredient={deleteIngredient}
          />
        </TabsContent>

        <TabsContent value="purchases" className="mt-6">
          <PurchasesTab
            purchases={purchases}
            purchaseItems={purchaseItems}
            loading={purchasesLoading}
            error={purchasesError}
            refetch={refetchPurchases}
            ingredients={ingredients}
            createPurchase={createPurchase}
            deletePurchase={deletePurchase}
            fetchPurchaseDetails={fetchPurchaseDetails}
            onGoToIngredients={() => setTab('ingredients')}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}

/* ============================ TAB 1 — INSUMOS ============================ */

interface IngredientsTabProps {
  ingredients: Ingredient[]
  loading: boolean
  error: string | null
  refetch: () => void
  createIngredient: (input: {
    name: string
    unit: 'kg' | 'g' | 'L' | 'mL' | 'unidade'
    currentStock: number
    minStock: number
  }) => Promise<Ingredient>
  updateIngredient: (
    id: string,
    input: Partial<{
      name: string
      unit: 'kg' | 'g' | 'L' | 'mL' | 'unidade'
      currentStock: number
      minStock: number
    }>,
  ) => Promise<Ingredient>
  deleteIngredient: (id: string) => Promise<void>
}

function IngredientsTab({
  ingredients,
  loading,
  error,
  refetch,
  createIngredient,
  updateIngredient,
  deleteIngredient,
}: IngredientsTabProps) {
  // Search (debounced 300ms).
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Sheet + delete dialog state.
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null)

  // Flash animation for realtime-created/updated rows.
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())

  const filtered = useMemo(() => {
    if (!searchTerm) return ingredients
    const term = searchTerm.toLowerCase()
    return ingredients.filter((i) => i.name.toLowerCase().includes(term))
  }, [ingredients, searchTerm])

  // Detect newly-added ingredients via realtime and flash them.
  useEffect(() => {
    const known = knownIdsRef.current
    let affected: string | null = null
    for (const i of ingredients) {
      if (!known.has(i.id)) {
        affected = i.id
        break
      }
    }
    known.clear()
    for (const i of ingredients) known.add(i.id)

    if (affected) {
      setFlashId(affected)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setFlashId(null), 600)
    }
  }, [ingredients])

  const lowStock = useMemo(
    () => ingredients.filter((i) => i.minStock > 0 && i.currentStock <= i.minStock),
    [ingredients],
  )

  function openCreate() {
    setEditingIngredient(null)
    setSheetOpen(true)
  }

  function openEdit(ingredient: Ingredient) {
    setEditingIngredient(ingredient)
    setSheetOpen(true)
  }

  return (
    <>
      {/* Low stock alert banner */}
      {lowStock.length > 0 && !loading && !error && (
        <div
          className="mb-6 flex items-start gap-2.5 rounded-[var(--radius)] px-4 py-3"
          style={{
            backgroundColor: 'hsl(var(--destructive) / 0.1)',
            border: '1px solid hsl(var(--destructive) / 0.3)',
          }}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">
              Atenção: {lowStock.length} insumo(s) com estoque baixo.
            </p>
            <p className="text-[0.8125rem] text-muted-foreground">
              {lowStock.map((i) => i.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar insumo..."
            className="h-11 rounded-[var(--radius)] border-border bg-background pl-10 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            aria-label="Buscar insumos"
          />
        </div>
        <Button
          onClick={openCreate}
          disabled={loading}
          className="h-11 gap-2 px-5 font-semibold transition-all duration-150 hover:brightness-108 active:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          <span>Cadastrar Insumo</span>
        </Button>
      </div>

      {/* Body */}
      <div>
        {loading ? (
          <IngredientsTableSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} title="Erro ao carregar" />
        ) : filtered.length === 0 ? (
          searchTerm ? (
            <SearchEmptyState />
          ) : (
            <IngredientsEmptyState onCreate={openCreate} />
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
                      Unidade
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Estoque Atual
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Estoque Mínimo
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
                  {filtered.map((ingredient) => (
                    <IngredientRow
                      key={ingredient.id}
                      ingredient={ingredient}
                      flashing={flashId === ingredient.id}
                      onEdit={() => openEdit(ingredient)}
                      onDelete={() => setDeleteTarget(ingredient)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-3 md:hidden">
              {filtered.map((ingredient) => (
                <IngredientCard
                  key={ingredient.id}
                  ingredient={ingredient}
                  flashing={flashId === ingredient.id}
                  onEdit={() => openEdit(ingredient)}
                  onDelete={() => setDeleteTarget(ingredient)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <IngredientFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        ingredient={editingIngredient}
        createIngredient={createIngredient}
        updateIngredient={updateIngredient}
      />

      <DeleteIngredientDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onDelete={async () => {
          if (!deleteTarget) return
          await deleteIngredient(deleteTarget.id)
        }}
      />
    </>
  )
}

function IngredientRow({
  ingredient,
  flashing,
  onEdit,
  onDelete,
}: {
  ingredient: Ingredient
  flashing: boolean
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
        {ingredient.name}
      </TableCell>
      <TableCell className="px-4 align-middle text-muted-foreground">{ingredient.unit}</TableCell>
      <TableCell className="tabular-nums px-4 align-middle">
        {formatNumber(ingredient.currentStock)} {ingredient.unit}
      </TableCell>
      <TableCell className="tabular-nums px-4 align-middle text-muted-foreground">
        {formatNumber(ingredient.minStock)} {ingredient.unit}
      </TableCell>
      <TableCell className="px-4 align-middle">
        <StockStatusBadge ingredient={ingredient} />
      </TableCell>
      <TableCell className="px-4 align-middle">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground"
            aria-label="Editar insumo"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            aria-label="Excluir insumo"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function IngredientCard({
  ingredient,
  flashing,
  onEdit,
  onDelete,
}: {
  ingredient: Ingredient
  flashing: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'flex animate-in fade-in-0 flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4',
        flashing && 'animate-row-flash',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.9375rem] font-semibold text-foreground">{ingredient.name}</p>
        <StockStatusBadge ingredient={ingredient} />
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>
          Estoque atual:{' '}
          <span className="tabular-nums font-medium text-foreground">
            {formatNumber(ingredient.currentStock)} {ingredient.unit}
          </span>
        </p>
        <p>
          Estoque mínimo:{' '}
          <span className="tabular-nums font-medium text-foreground">
            {formatNumber(ingredient.minStock)} {ingredient.unit}
          </span>
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-10 flex-1 text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground"
          aria-label="Editar insumo"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
        <Button
          variant="outline"
          className="h-10 flex-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          aria-label="Excluir insumo"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
      </div>
    </div>
  )
}

function StockStatusBadge({ ingredient }: { ingredient: Ingredient }) {
  if (ingredient.minStock <= 0) {
    return (
      <Badge
        variant="outline"
        className="inline-flex items-center gap-1 rounded-full border-transparent bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
      >
        <span className="h-1 w-1 rounded-full bg-muted-foreground" />
        Sem mínimo
      </Badge>
    )
  }
  if (ingredient.currentStock <= ingredient.minStock) {
    return (
      <Badge
        variant="outline"
        className="inline-flex items-center gap-1 rounded-full border-transparent px-2.5 py-1 text-xs font-medium"
        style={{
          backgroundColor: 'hsl(0 72% 45% / 0.15)',
          color: 'hsl(0 72% 40%)',
        }}
      >
        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: 'hsl(0 72% 45%)' }} />
        Estoque Baixo
      </Badge>
    )
  }
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
      Normal
    </Badge>
  )
}

function IngredientsTableSkeleton() {
  return (
    <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow className="h-12 bg-muted hover:bg-muted">
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Nome
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Unidade
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Estoque Atual
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Estoque Mínimo
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
                <Skeleton className="h-5 w-12 rounded-md" />
              </TableCell>
              <TableCell className="px-4">
                <Skeleton className="h-5 w-20 rounded-md" />
              </TableCell>
              <TableCell className="px-4">
                <Skeleton className="h-5 w-20 rounded-md" />
              </TableCell>
              <TableCell className="px-4">
                <Skeleton className="h-5 w-24 rounded-full" />
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

function IngredientsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border bg-card p-12 text-center">
      <Package className="h-12 w-12 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">Nenhum insumo cadastrado</h2>
      <p className="mt-2 max-w-[320px] text-sm text-muted-foreground">
        Cadastre seus insumos para registrar compras e definir receitas.
      </p>
      <Button onClick={onCreate} className="mt-6 h-11 gap-2 px-5 font-semibold">
        <Plus className="h-4 w-4" />
        Cadastrar Insumo
      </Button>
    </div>
  )
}

/* ============================ TAB 2 — COMPRAS ============================ */

interface PurchasesTabProps {
  purchases: Purchase[]
  purchaseItems: PurchaseItem[]
  loading: boolean
  error: string | null
  refetch: () => void
  ingredients: Ingredient[]
  createPurchase: (
    purchase: {
      supplier: string | null
      total: number
      date: string
    },
    items: {
      ingredientId: string
      quantity: number
      unitCost: number
    }[],
  ) => Promise<unknown>
  deletePurchase: (id: string) => Promise<void>
  fetchPurchaseDetails: (purchaseId: string) => Promise<PurchaseItem[]>
  onGoToIngredients: () => void
}

function PurchasesTab({
  purchases,
  purchaseItems,
  loading,
  error,
  refetch,
  ingredients,
  createPurchase,
  deletePurchase,
  fetchPurchaseDetails,
  onGoToIngredients,
}: PurchasesTabProps) {
  // Count items per purchase (from the loaded purchaseItems list).
  const itemCountByPurchase = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of purchaseItems) {
      map.set(item.purchaseId, (map.get(item.purchaseId) ?? 0) + 1)
    }
    return map
  }, [purchaseItems])
  // Sheet + delete dialog state.
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null)
  const [detailTarget, setDetailTarget] = useState<Purchase | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailItems, setDetailItems] = useState<PurchaseItem[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Pagination.
  const [page, setPage] = useState(1)

  // Flash animation.
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())

  // Reset to first page when list shrinks below the current page.
  const totalPages = Math.max(1, Math.ceil(purchases.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const paginated = useMemo(
    () => purchases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [purchases, currentPage],
  )

  // Detect newly-added purchases via realtime and flash them.
  useEffect(() => {
    const known = knownIdsRef.current
    let affected: string | null = null
    for (const p of purchases) {
      if (!known.has(p.id)) {
        affected = p.id
        break
      }
    }
    known.clear()
    for (const p of purchases) known.add(p.id)

    if (affected) {
      setFlashId(affected)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setFlashId(null), 600)
    }
  }, [purchases])

  // Load details when a purchase is selected for viewing.
  useEffect(() => {
    if (!detailOpen || !detailTarget) {
      setDetailItems([])
      return
    }
    let active = true
    setDetailLoading(true)
    void (async () => {
      try {
        const items = await fetchPurchaseDetails(detailTarget.id)
        if (active) setDetailItems(items)
      } catch (err) {
        if (active) {
          toast.error(err instanceof Error ? err.message : 'Erro ao carregar itens da compra.')
        }
      } finally {
        if (active) setDetailLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [detailOpen, detailTarget, fetchPurchaseDetails])

  function openCreate() {
    setFormOpen(true)
  }

  function openDetail(purchase: Purchase) {
    setDetailTarget(purchase)
    setDetailOpen(true)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-6 flex justify-end">
        <Button
          onClick={openCreate}
          disabled={loading}
          className="h-11 gap-2 px-5 font-semibold transition-all duration-150 hover:brightness-108 active:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          <span>Registrar Compra</span>
        </Button>
      </div>

      {/* Body */}
      <div>
        {loading ? (
          <PurchasesTableSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} title="Erro ao carregar" />
        ) : purchases.length === 0 ? (
          <PurchasesEmptyState onCreate={openCreate} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow className="h-12 bg-muted hover:bg-muted">
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Data
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Fornecedor
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Itens
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Total
                    </TableHead>
                    <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((purchase) => (
                    <PurchaseRow
                      key={purchase.id}
                      purchase={purchase}
                      itemCount={itemCountByPurchase.get(purchase.id) ?? 0}
                      flashing={flashId === purchase.id}
                      onView={() => openDetail(purchase)}
                      onDelete={() => setDeleteTarget(purchase)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-3 md:hidden">
              {paginated.map((purchase) => (
                <PurchaseCard
                  key={purchase.id}
                  purchase={purchase}
                  itemCount={itemCountByPurchase.get(purchase.id) ?? 0}
                  flashing={flashId === purchase.id}
                  onView={() => openDetail(purchase)}
                  onDelete={() => setDeleteTarget(purchase)}
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

      <PurchaseFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        ingredients={ingredients}
        ingredientsLoading={false}
        createPurchase={createPurchase}
        onGoToIngredients={onGoToIngredients}
      />

      <PurchaseDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        purchase={detailTarget}
        items={detailItems}
        ingredients={ingredients}
        loading={detailLoading}
      />

      <DeletePurchaseDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onDelete={async () => {
          if (!deleteTarget) return
          await deletePurchase(deleteTarget.id)
        }}
      />
    </>
  )
}

function PurchaseRow({
  purchase,
  itemCount,
  flashing,
  onView,
  onDelete,
}: {
  purchase: Purchase
  itemCount: number
  flashing: boolean
  onView: () => void
  onDelete: () => void
}) {
  return (
    <TableRow
      className={cn(
        'h-16 border-t border-border text-sm text-card-foreground transition-colors duration-150 hover:bg-muted/50',
        flashing && 'animate-row-flash',
      )}
    >
      <TableCell className="tabular-nums px-4 align-middle">{formatDate(purchase.date)}</TableCell>
      <TableCell className="px-4 align-middle">{purchase.supplier || '—'}</TableCell>
      <TableCell className="px-4 align-middle text-muted-foreground">
        {itemCount} {itemCount === 1 ? 'item' : 'itens'}
      </TableCell>
      <TableCell className="tabular-nums px-4 align-middle font-medium">
        {formatBRL(purchase.total)}
      </TableCell>
      <TableCell className="px-4 align-middle">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground"
            aria-label="Ver detalhes"
            onClick={onView}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            aria-label="Excluir compra"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function PurchaseCard({
  purchase,
  itemCount,
  flashing,
  onView,
  onDelete,
}: {
  purchase: Purchase
  itemCount: number
  flashing: boolean
  onView: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'flex animate-in fade-in-0 flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4',
        flashing && 'animate-row-flash',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="tabular-nums text-[0.9375rem] font-semibold text-foreground">
          {formatDate(purchase.date)}
        </p>
        <p className="tabular-nums text-base font-bold text-foreground">
          {formatBRL(purchase.total)}
        </p>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="truncate text-sm text-foreground">
          {purchase.supplier || <span className="text-muted-foreground">Sem fornecedor</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-10 flex-1 text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground"
          aria-label="Ver detalhes"
          onClick={onView}
        >
          <Eye className="h-4 w-4" />
          Detalhes
        </Button>
        <Button
          variant="outline"
          className="h-10 flex-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          aria-label="Excluir compra"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
      </div>
    </div>
  )
}

function PurchasesTableSkeleton() {
  return (
    <div className="hidden overflow-hidden rounded-[var(--radius)] border border-border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow className="h-12 bg-muted hover:bg-muted">
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Data
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Fornecedor
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Itens
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Total
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
                <Skeleton className="h-5 w-24 rounded-md" />
              </TableCell>
              <TableCell className="px-4">
                <Skeleton className="h-5 w-40 rounded-md" />
              </TableCell>
              <TableCell className="px-4">
                <Skeleton className="h-5 w-16 rounded-md" />
              </TableCell>
              <TableCell className="px-4">
                <Skeleton className="h-5 w-24 rounded-md" />
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

function PurchasesEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border bg-card p-12 text-center">
      <ShoppingCart className="h-12 w-12 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">Nenhuma compra registrada</h2>
      <p className="mt-2 max-w-[320px] text-sm text-muted-foreground">
        Registre suas compras para controlar o estoque e calcular custos.
      </p>
      <Button onClick={onCreate} className="mt-6 h-11 gap-2 px-5 font-semibold">
        <Plus className="h-4 w-4" />
        Registrar Compra
      </Button>
    </div>
  )
}

/* ============================ Shared states ============================ */

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

function ErrorState({
  message,
  onRetry,
  title,
}: {
  message: string
  onRetry: () => void
  title: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border bg-card p-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-[320px] text-sm text-muted-foreground">
        {message || 'Não foi possível carregar os dados.'}
      </p>
      <Button onClick={onRetry} variant="outline" className="mt-6 h-11 px-6">
        Tentar novamente
      </Button>
    </div>
  )
}
