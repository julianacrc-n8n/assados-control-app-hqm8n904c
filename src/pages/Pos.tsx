import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  X,
  CheckCircle,
  Loader2,
  Banknote,
  CreditCard,
  Smartphone,
  Printer,
  AlertTriangle,
  Package,
  Upload,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { PageHeader } from '@/components/PageHeader'
import { IfoodImportDialog } from '@/components/pos/IfoodImportDialog'
import { usePOS } from '@/hooks/usePOS'
import { useProductLookup } from '@/hooks/useProductLookup'
import { listActiveProducts, searchActiveProducts } from '@/services/sales'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Product, SaleResult } from '@/types'

type PaymentMethod = 'dinheiro' | 'cartao' | 'pix'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'Pix',
}

/** Format a sale date (ISO) as DD/MM/YYYY HH:mm (pt-BR, local time). */
function formatSaleDate(iso: string): string {
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

/** Parse a pt-BR decimal string ("12,50") into a number. */
function parseBRLNumber(value: string): number {
  if (!value) return 0
  const n = parseFloat(value.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Play a short 800Hz success beep via the Web Audio API (no audio file). */
function playSuccessBeep(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 800
    gain.gain.value = 0.15
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    oscillator.start(now)
    oscillator.stop(now + 0.1)
    oscillator.onended = () => {
      ctx.close().catch(() => {})
    }
  } catch {
    // Audio is best-effort; ignore failures.
  }
}

export default function PosPage() {
  const pos = usePOS()
  const { findByBarcode } = useProductLookup()

  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const [barcode, setBarcode] = useState('')
  const [shake, setShake] = useState(false)

  // Product search (debounced 300ms)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  // Active products check (for the empty-state banner)
  const [hasActiveProducts, setHasActiveProducts] = useState<boolean | null>(null)

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro')
  const [amountPaid, setAmountPaid] = useState('')
  // Delivery fee (optional). Empty string = treated as 0.
  const [deliveryFee, setDeliveryFee] = useState('')
  const deliveryFeeNumRaw = useMemo(() => parseBRLNumber(deliveryFee), [deliveryFee])
  const deliveryFeeNum = deliveryFeeNumRaw < 0 ? 0 : deliveryFeeNumRaw
  const deliveryFeeNegative = deliveryFeeNumRaw < 0
  const hasDeliveryFee = deliveryFeeNum > 0
  const grandTotal = useMemo(() => pos.cartTotal + deliveryFeeNum, [pos.cartTotal, deliveryFeeNum])

  // Dialogs
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [clearCartOpen, setClearCartOpen] = useState(false)
  const [ifoodOpen, setIfoodOpen] = useState(false)

  const cartEmpty = pos.cart.length === 0

  // Autofocus the barcode input on mount.
  useEffect(() => {
    barcodeInputRef.current?.focus()
  }, [])

  // Check whether the user has any active products (for the banner).
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const products = await listActiveProducts()
        if (mounted) setHasActiveProducts(products.length > 0)
      } catch {
        if (mounted) setHasActiveProducts(null)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Debounced product search (300ms).
  useEffect(() => {
    const term = searchInput.trim()
    if (!term) {
      setSearchResults([])
      setSearchOpen(false)
      setSearchTerm('')
      return
    }
    setSearchTerm(term)
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await searchActiveProducts(term)
        setSearchResults(results)
        setSearchOpen(true)
      } catch {
        setSearchResults([])
        setSearchOpen(true)
        toast.error('Erro ao buscar produto. Tente novamente.')
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const amountPaidNum = useMemo(() => parseBRLNumber(amountPaid), [amountPaid])
  const change = useMemo(
    () => (paymentMethod === 'dinheiro' ? amountPaidNum - grandTotal : 0),
    [paymentMethod, amountPaidNum, grandTotal],
  )
  const insufficientFunds = paymentMethod === 'dinheiro' && !cartEmpty && amountPaidNum < grandTotal
  const canCheckout =
    !cartEmpty &&
    !pos.checkingOut &&
    !deliveryFeeNegative &&
    (paymentMethod !== 'dinheiro' || amountPaidNum >= grandTotal)

  const addProductToCart = useCallback(
    (product: Product) => {
      pos.addToCart({
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
      })
      playSuccessBeep()
    },
    [pos],
  )

  const handleBarcodeSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const code = barcode.trim()
      if (!code) return
      if (pos.checkingOut) return
      try {
        const product = await findByBarcode(code)
        if (!product) {
          toast.error(`Produto não encontrado para o código: ${code}`, {
            description: undefined,
          })
          setShake(true)
          setTimeout(() => setShake(false), 400)
          setBarcode('')
          barcodeInputRef.current?.focus()
          return
        }
        if (!product.active) {
          toast.error(`Produto inativo: ${product.name}`)
          setBarcode('')
          barcodeInputRef.current?.focus()
          return
        }
        addProductToCart(product)
        setBarcode('')
        barcodeInputRef.current?.focus()
      } catch {
        toast.error('Erro ao buscar produto. Tente novamente.')
        setBarcode('')
        barcodeInputRef.current?.focus()
      }
    },
    [barcode, pos.checkingOut, findByBarcode, addProductToCart],
  )

  const handleSearchSelect = useCallback(
    (product: Product) => {
      addProductToCart(product)
      setSearchInput('')
      setSearchResults([])
      setSearchOpen(false)
      barcodeInputRef.current?.focus()
    },
    [addProductToCart],
  )

  const handleCheckout = useCallback(async () => {
    if (!canCheckout) return
    const amountPaidValue = paymentMethod === 'dinheiro' ? amountPaidNum : null
    const changeValue = paymentMethod === 'dinheiro' ? change : null
    try {
      const result: SaleResult = await pos.checkout({
        paymentMethod,
        amountPaid: amountPaidValue,
        change: changeValue,
        deliveryFee: deliveryFeeNum,
      })
      toast.success('Venda realizada com sucesso!')
      setPaymentMethod('dinheiro')
      setAmountPaid('')
      setDeliveryFee('')
      setReceiptOpen(true)
      if (pos.lowStockWarnings.length > 0) {
        toast.warning(`Atenção: estoque baixo para: ${pos.lowStockWarnings.join(', ')}`)
      }
      setTimeout(() => barcodeInputRef.current?.focus(), 0)
      void result
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Não foi possível finalizar a venda. Tente novamente.',
      )
    }
  }, [canCheckout, paymentMethod, amountPaidNum, change, pos, deliveryFeeNum])

  // Global keyboard shortcuts: F2 (focus barcode), F9 (checkout), Escape (close dropdown).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        barcodeInputRef.current?.focus()
        barcodeInputRef.current?.select()
      } else if (e.key === 'F9') {
        if (canCheckout) {
          e.preventDefault()
          void handleCheckout()
        }
      } else if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canCheckout, handleCheckout, searchOpen])

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Ponto de Venda"
          subtitle="Venda produtos com leitor de código de barras"
        />
        <Button
          variant="outline"
          className="h-11 shrink-0 gap-2 self-start"
          onClick={() => setIfoodOpen(true)}
          aria-label="Importar pedidos do iFood"
        >
          <Upload className="h-4 w-4" />
          Importar do iFood
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        {/* ===================== LEFT COLUMN ===================== */}
        <div className="flex flex-col gap-6">
          {/* No active products banner */}
          {hasActiveProducts === false && (
            <div
              className="flex items-start gap-2.5 rounded-[var(--radius)] px-4 py-3"
              style={{
                backgroundColor: 'hsl(var(--destructive) / 0.1)',
                border: '1px solid hsl(var(--destructive) / 0.3)',
              }}
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  Você não tem produtos ativos cadastrados.
                </p>
                <p className="text-[0.8125rem] text-muted-foreground">
                  Cadastre produtos na página de Produtos antes de vender.{' '}
                  <Link to="/products" className="font-medium text-primary underline">
                    Ir para Produtos
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Section 1 — Barcode scanner input */}
          <div className="rounded-[var(--radius)] border border-border bg-card p-5">
            <Label
              htmlFor="barcode-input"
              className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <ScanLine className="h-4 w-4 text-primary" />
              Código de Barras
            </Label>
            <form onSubmit={handleBarcodeSubmit}>
              <Input
                id="barcode-input"
                ref={barcodeInputRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Escaneie ou digite o código..."
                autoFocus
                autoComplete="off"
                aria-label="Campo de código de barras"
                className={cn(
                  'h-14 text-base font-medium tabular-nums',
                  shake && 'animate-horizontal-shake',
                )}
                disabled={pos.checkingOut}
              />
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              O leitor envia o código automaticamente. Você também pode digitar e pressionar Enter.
            </p>
          </div>

          {/* Section 2 — Product search */}
          <div className="rounded-[var(--radius)] border border-border bg-card p-5">
            <Label
              htmlFor="product-search"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Buscar Produto
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="product-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                onFocus={() => searchTerm && setSearchOpen(true)}
                placeholder="Buscar produto por nome..."
                aria-label="Buscar produto por nome"
                autoComplete="off"
                className="h-11 pl-10"
              />
              {searchOpen && (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                  {searchLoading ? (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buscando...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      Nenhum produto encontrado
                    </div>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto">
                      {searchResults.map((product) => (
                        <li key={product.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSearchSelect(product)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:bg-accent/20"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {product.name}
                              </p>
                              {product.barcode && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {product.barcode}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                              {formatBRL(product.price)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===================== RIGHT COLUMN ===================== */}
        <div className="flex flex-col gap-4 rounded-[var(--radius)] border border-border bg-card p-5">
          {/* Section 1 — Cart header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Carrinho</h2>
              <Badge variant="secondary" className="tabular-nums">
                {pos.itemCount} {pos.itemCount === 1 ? 'item' : 'itens'}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClearCartOpen(true)}
              disabled={cartEmpty || pos.checkingOut}
              className="h-9 gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Limpar
            </Button>
          </div>

          {/* Section 2 — Cart items list */}
          {cartEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold text-foreground">Carrinho vazio</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Escaneie ou busque produtos para adicionar.
              </p>
            </div>
          ) : (
            <div
              className="flex flex-col gap-2 overflow-y-auto pr-1"
              style={{ maxHeight: '400px' }}
            >
              {pos.cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-start gap-3 rounded-md border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatBRL(item.price)} cada
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Diminuir quantidade"
                      disabled={pos.checkingOut}
                      onClick={() => {
                        if (item.quantity <= 1) {
                          pos.removeFromCart(item.productId)
                        } else {
                          pos.updateQuantity(item.productId, item.quantity - 1)
                        }
                      }}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Aumentar quantidade"
                      disabled={pos.checkingOut}
                      onClick={() => pos.updateQuantity(item.productId, item.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {formatBRL(item.subtotal)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label="Remover item"
                      disabled={pos.checkingOut}
                      onClick={() => pos.removeFromCart(item.productId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Section 3 — Cart total */}
          {hasDeliveryFee ? (
            <div className="flex flex-col gap-1 border-t border-border pt-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground tabular-nums">
                <span>Subtotal</span>
                <span>{formatBRL(pos.cartTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground tabular-nums">
                <span>Taxa de Entrega</span>
                <span>{formatBRL(deliveryFeeNum)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Total</span>
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {formatBRL(grandTotal)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {formatBRL(pos.cartTotal)}
              </span>
            </div>
          )}

          {/* Section 4 — Payment (only when cart not empty) */}
          {!cartEmpty && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-foreground">Forma de Pagamento</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      { value: 'dinheiro', label: 'Dinheiro', Icon: Banknote },
                      { value: 'cartao', label: 'Cartão', Icon: CreditCard },
                      { value: 'pix', label: 'Pix', Icon: Smartphone },
                    ] as { value: PaymentMethod; label: string; Icon: typeof Banknote }[]
                  ).map(({ value, label, Icon }) => (
                    <Button
                      key={value}
                      type="button"
                      variant={paymentMethod === value ? 'default' : 'outline'}
                      className="h-11 gap-2"
                      disabled={pos.checkingOut}
                      onClick={() => setPaymentMethod(value)}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'dinheiro' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="amount-paid" className="text-sm font-medium text-foreground">
                    Valor Recebido (R$)
                  </Label>
                  <Input
                    id="amount-paid"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    placeholder="0,00"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    disabled={pos.checkingOut}
                    className="h-11 tabular-nums"
                  />
                  <div
                    className={cn(
                      'rounded-md px-3 py-2 text-sm',
                      insufficientFunds
                        ? 'bg-destructive/10 text-destructive'
                        : amountPaidNum === 0
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/10 text-primary',
                    )}
                  >
                    {insufficientFunds
                      ? 'Valor insuficiente'
                      : amountPaidNum === 0
                        ? 'Informe o valor recebido'
                        : `Troco: ${formatBRL(change)}`}
                  </div>
                </div>
              )}

              {/* Delivery fee — always visible when cart is not empty */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="delivery-fee" className="text-sm font-medium text-foreground">
                  Taxa de Entrega (R$)
                </Label>
                <Input
                  id="delivery-fee"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  placeholder="0,00"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  disabled={pos.checkingOut}
                  aria-label="Taxa de entrega em reais"
                  className="h-11 tabular-nums"
                />
                <p className="text-xs text-muted-foreground">Preencha se a venda for entrega.</p>
                {deliveryFeeNegative && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    A taxa de entrega não pode ser negativa.
                  </p>
                )}
              </div>

              {/* Section 5 — Checkout button */}
              <Button
                type="button"
                className="h-12 w-full gap-2 text-base font-semibold"
                disabled={!canCheckout}
                onClick={() => void handleCheckout()}
              >
                {pos.checkingOut ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Finalizar Venda
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Clear cart confirmation dialog */}
      <Dialog open={clearCartOpen} onOpenChange={setClearCartOpen}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col gap-2 text-center">
            <DialogTitle>Limpar carrinho?</DialogTitle>
            <DialogDescription>Todos os itens serão removidos.</DialogDescription>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" className="h-11" onClick={() => setClearCartOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              onClick={() => {
                pos.clearCart()
                setClearCartOpen(false)
                barcodeInputRef.current?.focus()
              }}
            >
              Limpar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* iFood import dialog */}
      <IfoodImportDialog open={ifoodOpen} onOpenChange={setIfoodOpen} />

      {/* Receipt dialog */}
      <Dialog
        open={receiptOpen}
        onOpenChange={(open) => {
          setReceiptOpen(open)
          if (!open) setTimeout(() => barcodeInputRef.current?.focus(), 0)
        }}
      >
        <DialogContent className="max-w-[400px]">
          <DialogTitle id="receipt-title" className="sr-only">
            Cupom da venda
          </DialogTitle>
          <DialogDescription className="sr-only">
            Cupom não fiscal da venda realizada.
          </DialogDescription>
          <ReceiptContent sale={pos.lastSale} onClose={() => setReceiptOpen(false)} />
        </DialogContent>
      </Dialog>
    </section>
  )
}

/* ============================ RECEIPT ============================ */

function ReceiptContent({ sale, onClose }: { sale: SaleResult | null; onClose: () => void }) {
  if (!sale) return null
  const methodLabel = PAYMENT_LABELS[sale.paymentMethod as PaymentMethod] ?? sale.paymentMethod
  const shortId = sale.saleId.slice(0, 8)

  return (
    <div
      id="receipt-print"
      className="receipt-print-area flex flex-col gap-2 font-mono text-sm text-foreground"
    >
      <h2 id="receipt-title" className="text-center text-base font-bold tracking-tight">
        Assados Control
      </h2>
      <p className="text-center text-xs text-muted-foreground">Cupom Não Fiscal</p>
      <div className="my-1 border-t border-dashed border-border" />
      <div className="flex justify-between text-xs">
        <span>{formatSaleDate(sale.date)}</span>
        <span>#{shortId}</span>
      </div>
      <div className="my-1 border-t border-dashed border-border" />
      <ul className="flex flex-col gap-1 text-xs">
        {sale.items.map((item) => (
          <li key={item.productId} className="flex flex-col">
            <span className="truncate">
              {item.quantity}x {item.name}
            </span>
            <span className="flex justify-between text-muted-foreground">
              <span>{formatBRL(item.price)} un</span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatBRL(item.subtotal)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="my-1 border-t border-dashed border-border" />
      {sale.deliveryFee > 0 && (
        <>
          <div className="flex justify-between text-xs">
            <span>Taxa de Entrega</span>
            <span className="tabular-nums">{formatBRL(sale.deliveryFee)}</span>
          </div>
          <div className="my-1 border-t border-dashed border-border" />
        </>
      )}
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span className="tabular-nums">{formatBRL(sale.total)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span>Pagamento:</span>
        <span>{methodLabel}</span>
      </div>
      {sale.paymentMethod === 'dinheiro' && (
        <>
          <div className="flex justify-between text-xs">
            <span>Recebido:</span>
            <span className="tabular-nums">{formatBRL(sale.amountPaid ?? 0)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Troco:</span>
            <span className="tabular-nums">{formatBRL(sale.change ?? 0)}</span>
          </div>
        </>
      )}
      <div className="my-1 border-t border-dashed border-border" />
      <p className="text-center text-xs">Obrigado pela preferência!</p>
      {sale.pickupCode && (
        <div className="mt-2 flex flex-col items-center gap-1">
          <p
            className="text-center font-bold uppercase"
            style={{ fontSize: '11px', letterSpacing: '2px' }}
          >
            Senha de Retirada
          </p>
          <span
            className="font-bold tabular-nums"
            style={{
              display: 'inline-block',
              border: '1px dashed #999',
              padding: '4px 8px',
              margin: '4px auto',
              fontSize: '32px',
              fontWeight: 700,
              letterSpacing: '6px',
            }}
          >
            {sale.pickupCode}
          </span>
          <p className="text-center text-muted-foreground" style={{ fontSize: '8px' }}>
            Apresente esta senha no balcão para retirar seu pedido.
          </p>
        </div>
      )}
      <div className="mt-3 flex gap-2 print:hidden">
        <Button type="button" className="h-11 flex-1 gap-2" onClick={() => openPrintWindow(sale)}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  )
}

/**
 * Build a self-contained HTML document for the receipt and open it in a
 * dedicated print window. This avoids the CSS visibility limitation where a
 * Radix Dialog portal wrapper marked `visibility: hidden` prevents its
 * descendants from being shown in print. Falls back to `window.print()` when
 * the popup is blocked.
 */
function openPrintWindow(sale: SaleResult): void {
  const methodLabel = PAYMENT_LABELS[sale.paymentMethod as PaymentMethod] ?? sale.paymentMethod
  const shortId = sale.saleId.slice(0, 8)

  const itemsHtml = sale.items
    .map(
      (item) => `
        <div class="item" style="display:flex;justify-content:space-between;font-size:11px;line-height:1.6;">
          <span>${item.quantity}x ${escapeHtml(item.name)}</span>
          <span style="font-weight:700;">${formatBRL(item.subtotal)}</span>
        </div>
        <div class="item-unit" style="font-size:9px;color:#666;text-align:left;">
          ${formatBRL(item.price)} un
        </div>`,
    )
    .join('')

  const cashHtml =
    sale.paymentMethod === 'dinheiro'
      ? `
        <div style="display:flex;justify-content:space-between;font-size:10px;line-height:1.6;">
          <span>Recebido:</span>
          <span>${formatBRL(sale.amountPaid ?? 0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;line-height:1.6;">
          <span>Troco:</span>
          <span>${formatBRL(sale.change ?? 0)}</span>
        </div>`
      : ''

  const deliveryHtml =
    sale.deliveryFee > 0
      ? `
        <div class="dashed"></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;line-height:1.6;">
          <span>Taxa de Entrega</span>
          <span>${formatBRL(sale.deliveryFee)}</span>
        </div>`
      : ''

  const pickupCodeHtml = sale.pickupCode
    ? `
        <div style="text-align:center;font-weight:700;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:2mm;">Senha de Retirada</div>
        <div style="text-align:center;margin-top:1mm;">
          <span style="display:inline-block;border:1px dashed #999;padding:4px 8px;margin:4px auto;font-size:32px;font-weight:700;letter-spacing:6px;">${escapeHtml(sale.pickupCode)}</span>
        </div>
        <div style="text-align:center;font-size:8px;color:#666;">Apresente esta senha no balcão para retirar seu pedido.</div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Cupom Não Fiscal</title>
<style>
  * { box-sizing: border-box; }
  @page { size: 80mm auto; margin: 0; }
  html { margin: 0; padding: 0; }
  body {
    width: 80mm;
    margin: 0;
    padding: 2mm 4mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.6;
    color: black;
    background: white;
  }
  .receipt {
    width: 100%;
    padding: 0;
    border: none;
    box-shadow: none;
    border-radius: 0;
    background: white;
  }
  .header {
    text-align: center;
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 2mm;
  }
  .subheader {
    text-align: center;
    font-size: 10px;
    margin-bottom: 2mm;
  }
  .dashed {
    border-top: 1px dashed #999;
    margin: 2mm 0;
    width: 100%;
  }
  .meta {
    font-size: 10px;
    color: black;
    line-height: 1.5;
    display: flex;
    justify-content: space-between;
  }
  .items { font-size: 11px; line-height: 1.6; }
  .total {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 700;
    margin-top: 1mm;
  }
  .footer {
    text-align: center;
    font-size: 10px;
    margin-top: 1mm;
  }
  .cut-margin { height: 5mm; }
  @media print and (max-width: 58mm) {
    body {
      padding: 2mm 2mm;
      font-size: 10px;
      line-height: 1.4;
    }
    .receipt {
      padding: 0 2mm;
    }
    .header { font-size: 13px; }
    .items { font-size: 10px; line-height: 1.4; }
    .item { font-size: 10px !important; line-height: 1.4 !important; }
    .item-unit { font-size: 8px !important; }
    .total { font-size: 12px; }
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="header">Assados Control</div>
    <div class="subheader">Cupom Não Fiscal</div>
    <div class="dashed"></div>
    <div class="meta">
      <span>${formatSaleDate(sale.date)}</span>
      <span>#${shortId}</span>
    </div>
    <div class="dashed"></div>
    <div class="items">
      ${itemsHtml}
    </div>
    <div class="dashed"></div>
    ${deliveryHtml}
    <div class="total">
      <span>TOTAL</span>
      <span>${formatBRL(sale.total)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;line-height:1.6;">
      <span>Pagamento:</span>
      <span>${escapeHtml(methodLabel)}</span>
    </div>
    ${cashHtml}
    <div class="dashed"></div>
    <div class="footer">Obrigado pela preferência!</div>
    ${pickupCodeHtml}
    <div class="cut-margin"></div>
  </div>
  <script>
    window.onload = function () { window.print(); };
    window.onafterprint = function () { window.close(); };
  </script>
</body>
</html>`

  const printWin = window.open('', '_blank', 'width=400,height=600')
  if (!printWin) {
    // Popup blocked — fall back to printing the current page.
    window.print()
    return
  }
  printWin.document.open()
  printWin.document.write(html)
  printWin.document.close()
}

/** Escape a string for safe insertion into raw HTML. */
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
