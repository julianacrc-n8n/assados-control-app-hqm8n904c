import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  Package,
  PlusCircle,
  Upload,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatBRL } from '@/lib/format'
import { createProduct, listProducts } from '@/services/products'
import {
  createIfoodSale,
  createIfoodStockAdjustment,
  listImportedIfoodOrderIds,
} from '@/services/sales'
import type { Product } from '@/types'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const PEDIDOS_SHEET_INDEX = 0
const CARDÁPIO_SHEET_INDEX = 1

const PAYMENT_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'Pix',
}

/** Map an iFood forma_de_pagamento string to a known payment method value. */
function mapPaymentMethod(raw: string): string {
  const s = (raw || '').toLowerCase()
  if (s.includes('pix') || s.includes('app do banco')) return 'pix'
  if (
    s.includes('crédito') ||
    s.includes('credito') ||
    s.includes('débito') ||
    s.includes('debito') ||
    s.includes('carteira')
  ) {
    return 'cartao'
  }
  return 'dinheiro'
}

/** Format a Date as DD/MM/YYYY HH:mm (pt-BR, local time). */
function formatDateTime(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

/** Format a Date as DD/MM/YYYY (pt-BR, local time). */
function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Parse an iFood datetime string ("YYYY-MM-DD HH:mm:ss") into a Date. */
function parseIfoodDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const str = String(value).trim()
  if (!str) return null
  // "2026-07-26 12:04:15" -> ISO with T separator
  const iso = str.replace(' ', 'T')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/\s/g, '').replace(/[R$]/g, '')
    // Excel may use dot decimal separator; fall back to pt-BR comma.
    const withDot =
      cleaned.includes('.') && cleaned.includes(',')
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(',', '.')
    const n = parseFloat(withDot)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/**
 * Normalize an iFood Excel header so it can be compared regardless of case,
 * accents, parentheses, spaces or underscores.
 *
 * e.g. "VALOR DOS ITENS (R$)" -> "valordositens"
 *      "VALOR LÍQUIDO (R$)"    -> "valorliquido"
 */
function normalizeHeader(header: string): string {
  return (header || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (á à â ã é ê í ó ô õ ú ç ...)
    .replace(/\([^)]*\)/g, '') // remove content between parentheses, e.g. "(R$)"
    .replace(/[\s_]/g, '') // remove spaces and underscores
    .replace(/[^a-z0-9]/g, '') // remove any remaining non-alphanumeric chars
}

/* ------------------------------------------------------------------ */
/* Row types                                                           */
/* ------------------------------------------------------------------ */

interface PedidoRow {
  orderId: string
  date: Date | null
  status: string
  itemsValue: number
  deliveryFee: number
  commission: number
  netValue: number
  totalPaid: number
  paymentRaw: string
  paymentMapped: string
  alreadyImported: boolean
  selected: boolean
}

interface CardapioRow {
  itemName: string
  quantity: number
  totalValue: number
  matchedProduct: Product | null
  selected: boolean
}

type StepStatus = 'idle' | 'loading' | 'parsing' | 'success' | 'error'

/* ------------------------------------------------------------------ */
/* File drop zone                                                      */
/* ------------------------------------------------------------------ */

interface DropzoneProps {
  label: string
  disabled?: boolean
  parsing?: boolean
  fileName: string | null
  error?: string | null
  onFile: (file: File) => void
  onClear: () => void
}

function FileDropzone({
  label,
  disabled,
  parsing,
  fileName,
  error,
  onFile,
  onClear,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled || parsing) return
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
        disabled={disabled || parsing}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled && !parsing) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        disabled={disabled || parsing}
        aria-label={label}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/30 hover:border-ring/40 hover:bg-muted/50',
        )}
      >
        {parsing ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Processando arquivo...</span>
          </>
        ) : fileName ? (
          <>
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <span className="max-w-full truncate text-sm font-medium text-foreground">
              {fileName}
            </span>
            <span className="text-xs text-muted-foreground">
              Clique em &ldquo;Trocar arquivo&rdquo; para selecionar outro.
            </span>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground">
              Arraste e solte ou clique para procurar (.xlsx, .xls)
            </span>
          </>
        )}
      </button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {fileName && !parsing && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-fit gap-2"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Upload className="h-4 w-4" />
          Trocar arquivo
        </Button>
      )}
      {fileName && !parsing && !error && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-fit gap-1.5 text-muted-foreground"
          onClick={onClear}
          disabled={disabled}
        >
          <X className="h-3.5 w-3.5" />
          Remover
        </Button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Stepper indicator                                                   */
/* ------------------------------------------------------------------ */

function StepperItem({
  index,
  title,
  current,
  done,
}: {
  index: number
  title: string
  current: boolean
  done: boolean
}) {
  return (
    <div className="flex items-center gap-3" aria-current={current ? 'step' : undefined}>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
          done
            ? 'border-primary bg-primary text-primary-foreground'
            : current
              ? 'border-primary text-primary'
              : 'border-border text-muted-foreground',
        )}
      >
        {done ? <Check className="h-4 w-4" /> : index}
      </span>
      <span
        className={cn(
          'text-sm font-medium',
          done || current ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {title}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

interface IfoodImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IfoodImportDialog({ open, onOpenChange }: IfoodImportDialogProps) {
  // STEP 1 — Pedidos
  const [pedidosFile, setPedidosFile] = useState<File | null>(null)
  const [pedidosStatus, setPedidosStatus] = useState<StepStatus>('idle')
  const [pedidosError, setPedidosError] = useState<string | null>(null)
  const [pedidos, setPedidos] = useState<PedidoRow[]>([])
  const [pedidosWarning, setPedidosWarning] = useState<string | null>(null)
  const [ignoredCount, setIgnoredCount] = useState(0)
  const [ignoredVisible, setIgnoredVisible] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [step1Done, setStep1Done] = useState(false)

  // STEP 2 — Cardápio
  const [cardapioFile, setCardapioFile] = useState<File | null>(null)
  const [cardapioStatus, setCardapioStatus] = useState<StepStatus>('idle')
  const [cardapioError, setCardapioError] = useState<string | null>(null)
  const [cardapio, setCardapio] = useState<CardapioRow[]>([])
  const [cardapioImporting, setCardapioImporting] = useState(false)
  const [cardapioProgress, setCardapioProgress] = useState(0)
  const [step2Done, setStep2Done] = useState(false)

  const reset = useCallback(() => {
    setPedidosFile(null)
    setPedidosStatus('idle')
    setPedidosError(null)
    setPedidos([])
    setPedidosWarning(null)
    setIgnoredCount(0)
    setIgnoredVisible(false)
    setImporting(false)
    setImportProgress(0)
    setStep1Done(false)
    setCardapioFile(null)
    setCardapioStatus('idle')
    setCardapioError(null)
    setCardapio([])
    setCardapioImporting(false)
    setCardapioProgress(0)
    setStep2Done(false)
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset()
      onOpenChange(next)
    },
    [onOpenChange, reset],
  )

  /* ---------------- Step 1: parse pedidos ---------------- */

  const parsePedidos = useCallback(async (file: File) => {
    setPedidosFile(file)
    setPedidosStatus('parsing')
    setPedidosError(null)
    setPedidosWarning(null)
    setPedidos([])
    setIgnoredCount(0)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames[PEDIDOS_SHEET_INDEX]
      if (!sheetName) {
        setPedidosStatus('error')
        setPedidosError(
          'Arquivo inválido. Selecione um arquivo .xlsx ou .xls exportado do portal do iFood.',
        )
        return
      }
      const sheet = wb.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      if (json.length === 0) {
        setPedidosStatus('error')
        setPedidosError('Nenhum pedido encontrado no arquivo.')
        return
      }

      // Validate headers (best-effort).
      const headers = Object.keys(json[0] || {})
      const expected = [
        'ID COMPLETO DO PEDIDO',
        'DATA E HORA DO PEDIDO',
        'STATUS FINAL DO PEDIDO',
        'VALOR DOS ITENS (R$)',
        'TOTAL PAGO PELO CLIENTE (R$)',
        'TAXA DE ENTREGA PAGA PELO CLIENTE (R$)',
        'TAXAS E COMISSÕES (R$)',
        'VALOR LÍQUIDO (R$)',
        'FORMA DE PAGAMENTO',
      ]
      const missing = expected.filter(
        (h) => !headers.some((x) => normalizeHeader(x) === normalizeHeader(h)),
      )
      if (missing.length > 0) {
        setPedidosWarning(
          'O arquivo não parece ser um relatório do iFood. Verifique se você exportou o relatório correto.',
        )
      }

      const headerMap = (key: string) =>
        headers.find((h) => normalizeHeader(h) === normalizeHeader(key))

      const hOrderId = headerMap('ID COMPLETO DO PEDIDO')
      const hDate = headerMap('DATA E HORA DO PEDIDO')
      const hStatus = headerMap('STATUS FINAL DO PEDIDO')
      const hItems = headerMap('VALOR DOS ITENS (R$)')
      const hPaid = headerMap('TOTAL PAGO PELO CLIENTE (R$)')
      const hDelivery = headerMap('TAXA DE ENTREGA PAGA PELO CLIENTE (R$)')
      const hCommission = headerMap('TAXAS E COMISSÕES (R$)')
      const hNet = headerMap('VALOR LÍQUIDO (R$)')
      const hPayment = headerMap('FORMA DE PAGAMENTO')

      // Dedup set.
      const importedIds = await listImportedIfoodOrderIds()

      let ignored = 0
      const rows: PedidoRow[] = []
      for (const r of json) {
        const status = String(r[hStatus || 'STATUS FINAL DO PEDIDO'] ?? '').trim()
        const orderId = String(r[hOrderId || 'ID COMPLETO DO PEDIDO'] ?? '').trim()
        const date = parseIfoodDate(r[hDate || 'DATA E HORA DO PEDIDO'])
        const itemsValue = toNumber(r[hItems || 'VALOR DOS ITENS (R$)'])
        const paid = toNumber(r[hPaid || 'TOTAL PAGO PELO CLIENTE (R$)'])
        const delivery = toNumber(r[hDelivery || 'TAXA DE ENTREGA PAGA PELO CLIENTE (R$)'])
        const commission = Math.abs(toNumber(r[hCommission || 'TAXAS E COMISSÕES (R$)']))
        const net = toNumber(r[hNet || 'VALOR LÍQUIDO (R$)'])
        const paymentRaw = String(r[hPayment || 'FORMA DE PAGAMENTO'] ?? '').trim()

        const isConcluido = status.toUpperCase() === 'CONCLUIDO'
        const alreadyImported = Boolean(orderId) && importedIds.has(orderId)

        if (!isConcluido) {
          ignored += 1
          // Keep ignored rows for the collapsible list.
          rows.push({
            orderId,
            date,
            status,
            itemsValue,
            deliveryFee: delivery,
            commission,
            netValue: net,
            totalPaid: paid,
            paymentRaw,
            paymentMapped: mapPaymentMethod(paymentRaw),
            alreadyImported: false,
            selected: false,
          })
          continue
        }

        rows.push({
          orderId,
          date,
          status,
          itemsValue,
          deliveryFee: delivery,
          commission,
          netValue: net,
          totalPaid: paid,
          paymentRaw,
          paymentMapped: mapPaymentMethod(paymentRaw),
          alreadyImported,
          selected: !alreadyImported,
        })
      }

      setPedidos(rows)
      setIgnoredCount(ignored)
      setPedidosStatus('success')

      const concluidos = rows.filter((r) => r.status.toUpperCase() === 'CONCLUIDO')
      if (concluidos.length === 0) {
        setPedidosError(`Nenhum pedido concluído no arquivo. (${ignored} ignorados)`)
      }
    } catch {
      setPedidosStatus('error')
      setPedidosError('Não foi possível ler o arquivo. Verifique se o formato está correto.')
    }
  }, [])

  const concluidos = useMemo(
    () => pedidos.filter((r) => r.status.toUpperCase() === 'CONCLUIDO'),
    [pedidos],
  )
  const alreadyImportedCount = useMemo(
    () => concluidos.filter((r) => r.alreadyImported).length,
    [concluidos],
  )
  const selectedToImport = useMemo(
    () => concluidos.filter((r) => r.selected && !r.alreadyImported),
    [concluidos],
  )

  const togglePedido = (orderId: string) => {
    setPedidos((prev) =>
      prev.map((r) =>
        r.orderId === orderId && !r.alreadyImported && r.status.toUpperCase() === 'CONCLUIDO'
          ? { ...r, selected: !r.selected }
          : r,
      ),
    )
  }

  /* ---------------- Step 1: import ---------------- */

  const handleImportPedidos = useCallback(async () => {
    if (selectedToImport.length === 0 || importing) return
    setImporting(true)
    setImportProgress(0)
    let done = 0
    let failed = 0
    const total = selectedToImport.length
    try {
      for (const row of selectedToImport) {
        try {
          await createIfoodSale({
            total: row.itemsValue,
            deliveryFee: row.deliveryFee,
            ifoodCommission: row.commission,
            ifoodOrderId: row.orderId,
            paymentMethod: row.paymentMapped,
            date: row.date ? row.date.toISOString() : new Date().toISOString(),
            amountPaid: row.totalPaid,
          })
          done += 1
        } catch {
          failed += 1
        }
        setImportProgress(Math.round(((done + failed) / total) * 100))
      }

      // Mark imported rows.
      setPedidos((prev) =>
        prev.map((r) =>
          selectedToImport.some((s) => s.orderId === r.orderId) && failed === 0
            ? { ...r, alreadyImported: true, selected: false }
            : r,
        ),
      )

      if (failed === 0) {
        toast.success(`${done} pedidos importados com sucesso.`)
        setStep1Done(true)
      } else if (done > 0) {
        toast.success(`${done} pedidos importados com sucesso.`)
        toast.error(`${failed} pedidos não puderam ser importados.`)
        setStep1Done(done > 0)
      } else {
        toast.error('Erro ao importar pedidos. Tente novamente.')
      }
    } catch {
      toast.error('Erro ao importar pedidos. Tente novamente.')
    } finally {
      setImporting(false)
      setImportProgress(100)
    }
  }, [selectedToImport, importing])

  /* ---------------- Step 2: parse cardápio ---------------- */

  const parseCardapio = useCallback(async (file: File) => {
    setCardapioFile(file)
    setCardapioStatus('parsing')
    setCardapioError(null)
    setCardapio([])
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames[CARDÁPIO_SHEET_INDEX]
      if (!sheetName) {
        setCardapioStatus('error')
        setCardapioError(
          'Arquivo inválido. Selecione um arquivo .xlsx ou .xls exportado do portal do iFood.',
        )
        return
      }
      const sheet = wb.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      if (json.length === 0) {
        setCardapioStatus('error')
        setCardapioError('Nenhum item encontrado no arquivo.')
        return
      }

      const headers = Object.keys(json[0] || {})
      const headerMap = (key: string) =>
        headers.find((h) => normalizeHeader(h) === normalizeHeader(key))
      const hName = headerMap('NOME DO ITEM')
      const hQty = headerMap('VENDAS TOTAL QUANTIDADE')
      const hTotal = headerMap('VALOR TOTAL')

      const products = await listProducts()

      const rows: CardapioRow[] = json.map((r) => {
        const itemName = String(r[hName || 'NOME DO ITEM'] ?? '').trim()
        const quantity = toNumber(r[hQty || 'VENDAS TOTAL QUANTIDADE'])
        const totalValue = toNumber(r[hTotal || 'VALOR TOTAL'])
        const matched = matchProduct(itemName, products)
        return {
          itemName,
          quantity,
          totalValue,
          matchedProduct: matched,
          // Matched and unmatched items are both checked by default. Matched
          // items link to an existing product; unmatched items will be auto
          // created as new products at import time.
          selected: true,
        }
      })

      setCardapio(rows)
      setCardapioStatus('success')
    } catch {
      setCardapioStatus('error')
      setCardapioError('Não foi possível ler o arquivo. Verifique se o formato está correto.')
    }
  }, [])

  const matchedCardapio = useMemo(
    () => cardapio.filter((r) => r.matchedProduct !== null),
    [cardapio],
  )
  const unmatchedCardapio = useMemo(
    () => cardapio.filter((r) => r.matchedProduct === null),
    [cardapio],
  )
  const selectedMatchedCardapio = useMemo(
    () => matchedCardapio.filter((r) => r.selected),
    [matchedCardapio],
  )
  const selectedUnmatchedCardapio = useMemo(
    () => unmatchedCardapio.filter((r) => r.selected),
    [unmatchedCardapio],
  )
  const selectedCardapio = useMemo(
    () => [...selectedMatchedCardapio, ...selectedUnmatchedCardapio],
    [selectedMatchedCardapio, selectedUnmatchedCardapio],
  )
  const uncheckedUnmatchedCardapio = useMemo(
    () => unmatchedCardapio.filter((r) => !r.selected),
    [unmatchedCardapio],
  )

  const toggleCardapio = (itemName: string) => {
    setCardapio((prev) =>
      prev.map((r) => (r.itemName === itemName ? { ...r, selected: !r.selected } : r)),
    )
  }

  const allMatchedChecked = matchedCardapio.length > 0 && matchedCardapio.every((r) => r.selected)
  const toggleAllMatched = (checked: boolean) => {
    setCardapio((prev) =>
      prev.map((r) => (r.matchedProduct !== null ? { ...r, selected: checked } : r)),
    )
  }
  const allUnmatchedChecked =
    unmatchedCardapio.length > 0 && unmatchedCardapio.every((r) => r.selected)
  const toggleAllUnmatched = (checked: boolean) => {
    setCardapio((prev) =>
      prev.map((r) => (r.matchedProduct === null ? { ...r, selected: checked } : r)),
    )
  }

  /* ---------------- Step 2: import ---------------- */

  const handleImportCardapio = useCallback(async () => {
    if (selectedCardapio.length === 0 || cardapioImporting) return
    setCardapioImporting(true)
    setCardapioProgress(0)

    // Snapshot the products collection once for deduplication against pre-existing
    // products as well as products created during this same import run.
    let existing: Product[]
    try {
      existing = await listProducts()
    } catch {
      toast.error('Não foi possível carregar os produtos. Tente novamente.')
      setCardapioImporting(false)
      return
    }
    const byName = new Map<string, Product>()
    for (const p of existing) byName.set(p.name.trim().toLowerCase(), p)

    const creationDescription = `Produto criado automaticamente da importação do iFood em ${formatDate(new Date())}`

    // Phase 1 — create products for each checked unmatched item (with dedup).
    const toCreate = selectedUnmatchedCardapio
    // Map of row.itemName -> resolved Product (newly created or pre-existing
    // duplicate). Only populated for rows that succeeded.
    const resolvedByName = new Map<string, Product>()
    const creationFailures: string[] = []
    if (toCreate.length > 0) {
      for (let i = 0; i < toCreate.length; i++) {
        const row = toCreate[i]
        try {
          const key = row.itemName.trim().toLowerCase()
          const cached = byName.get(key)
          if (cached) {
            resolvedByName.set(row.itemName, cached)
          } else {
            const price = row.quantity > 0 ? row.totalValue / row.quantity : row.totalValue
            const created = await createProduct({
              name: row.itemName,
              barcode: null,
              price,
              description: creationDescription,
              active: true,
            })
            byName.set(key, created)
            resolvedByName.set(row.itemName, created)
          }
        } catch {
          creationFailures.push(row.itemName)
        }
        setCardapioProgress(Math.round(((i + 1) / toCreate.length) * 50))
      }
    }

    // If every unmatched product creation failed, surface a hard error.
    if (toCreate.length > 0 && resolvedByName.size === 0) {
      toast.error('Não foi possível criar os produtos. Tente novamente.')
      setCardapioImporting(false)
      return
    }

    // Phase 2 — consolidated stock-adjustment sale for matched + newly created.
    setCardapioProgress(50)
    const matchedItems = selectedMatchedCardapio.map((r) => {
      const qty = r.quantity > 0 ? r.quantity : 0
      const unitPrice = qty > 0 ? r.totalValue / qty : 0
      return { productId: r.matchedProduct!.id, quantity: qty, unitPrice }
    })
    const createdItems = toCreate
      .filter((r) => resolvedByName.has(r.itemName))
      .map((r) => {
        const product = resolvedByName.get(r.itemName)!
        const qty = r.quantity > 0 ? r.quantity : 0
        const unitPrice = qty > 0 ? r.totalValue / qty : 0
        return { productId: product.id, quantity: qty, unitPrice }
      })
    const createdCount = resolvedByName.size
    const createdProducts = Array.from(resolvedByName.values())

    // If dedup collapsed a to-be-created product onto a matched product, the
    // items list may contain duplicates; that is fine — each row is its own
    // sale_item and the BOM hook sums them.
    const items = [...matchedItems, ...createdItems]
    let importedCount = 0
    try {
      await createIfoodStockAdjustment(items)
      importedCount = items.length
      setCardapioProgress(100)
    } catch {
      toast.error('Erro ao importar itens. Tente novamente.')
      setCardapioImporting(false)
      return
    }

    // Per-item creation failures: warn about each skipped item.
    for (const name of creationFailures) {
      toast.warning(
        `Não foi possível criar o produto ${name}. Verifique e tente importar novamente.`,
      )
    }

    toast.success(
      `${importedCount} itens importados e ${createdProducts.length} produtos criados automaticamente.`,
    )

    if (uncheckedUnmatchedCardapio.length > 0) {
      toast.warning(
        `${uncheckedUnmatchedCardapio.length} itens sem correspondência foram ignorados: ${uncheckedUnmatchedCardapio.map((r) => r.itemName).join(', ')}`,
      )
    }

    setStep2Done(true)
    setCardapioImporting(false)
  }, [
    selectedCardapio,
    cardapioImporting,
    selectedUnmatchedCardapio,
    selectedMatchedCardapio,
    uncheckedUnmatchedCardapio,
  ])

  /* ---------------- Render ---------------- */

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[900px] w-full"
        aria-labelledby="ifood-import-title"
        aria-describedby="ifood-import-desc"
      >
        <div className="flex items-center gap-2 pr-8">
          <Upload className="h-5 w-5 text-primary" />
          <DialogTitle id="ifood-import-title">Importar do iFood</DialogTitle>
        </div>
        <DialogDescription id="ifood-import-desc" className="sr-only">
          Importe pedidos e cardápio do iFood para o sistema.
        </DialogDescription>

        {/* Stepper */}
        <ol className="flex flex-col gap-3" aria-label="Etapas da importação">
          <li>
            <StepperItem index={1} title="Pedidos" current={!step1Done} done={step1Done} />
          </li>
          <li>
            <StepperItem
              index={2}
              title="Cardápio (Estoque)"
              current={step1Done && !step2Done}
              done={step2Done}
            />
          </li>
        </ol>

        <Separator />

        {/* STEP 1 */}
        <section className="flex flex-col gap-3" aria-labelledby="step1-title">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <h3 id="step1-title" className="text-sm font-semibold text-foreground">
              Passo 1 — Importar Pedidos
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Selecione o relatório de pedidos exportado do portal do iFood.
          </p>

          <FileDropzone
            label="Selecionar relatório de pedidos"
            disabled={importing || step1Done}
            parsing={pedidosStatus === 'parsing'}
            fileName={pedidosFile?.name ?? null}
            error={pedidosError}
            onFile={(f) => void parsePedidos(f)}
            onClear={() => {
              setPedidosFile(null)
              setPedidosStatus('idle')
              setPedidosError(null)
              setPedidos([])
            }}
          />

          {pedidosWarning && (
            <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {pedidosWarning}
            </p>
          )}

          {/* Pedidos preview */}
          {pedidosStatus === 'success' && concluidos.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                        Importar
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                        Data
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                        ID do Pedido
                      </th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                        Valor dos Itens
                      </th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                        Taxa de Entrega
                      </th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                        Comissão iFood
                      </th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                        Valor Líquido
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                        Pagamento
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {concluidos.map((r, idx) => (
                      <tr
                        key={`${r.orderId}-${idx}`}
                        className={cn('border-t border-border', r.alreadyImported && 'bg-muted/40')}
                      >
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={r.selected}
                              disabled={r.alreadyImported}
                              onCheckedChange={() => togglePedido(r.orderId)}
                              aria-label={`Importar pedido ${r.orderId}`}
                            />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-foreground tabular-nums">
                          {r.date ? formatDateTime(r.date) : '—'}
                        </td>
                        <td
                          className="max-w-[140px] truncate px-2 py-2 text-muted-foreground"
                          title={r.orderId}
                        >
                          {r.orderId}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right text-foreground tabular-nums">
                          {formatBRL(r.itemsValue)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right text-muted-foreground tabular-nums">
                          {formatBRL(r.deliveryFee)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right text-muted-foreground tabular-nums">
                          {formatBRL(r.commission)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right text-foreground tabular-nums">
                          {formatBRL(r.netValue)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-foreground">
                          {PAYMENT_LABEL[r.paymentMapped] ?? r.paymentMapped}
                        </td>
                        <td className="px-2 py-2">
                          {r.alreadyImported ? (
                            <Badge variant="secondary" className="text-muted-foreground">
                              Já importado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-primary">
                              Concluído
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-muted-foreground">
                {selectedToImport.length} pedidos para importar ({ignoredCount} ignorados,{' '}
                {alreadyImportedCount} já importados).
              </p>

              {importing && (
                <div className="flex flex-col gap-1.5">
                  <Progress value={importProgress} />
                  <p className="text-xs text-muted-foreground">
                    Importando {Math.round((importProgress / 100) * selectedToImport.length)} de{' '}
                    {selectedToImport.length} pedidos...
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  className="h-11 gap-2"
                  disabled={selectedToImport.length === 0 || importing || step1Done}
                  onClick={() => void handleImportPedidos()}
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Importar Pedidos
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Ignored orders collapsible */}
          {ignoredCount > 0 && pedidosStatus !== 'idle' && (
            <Collapsible open={ignoredVisible} onOpenChange={setIgnoredVisible}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground">
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', ignoredVisible && 'rotate-180')}
                  />
                  Pedidos ignorados ({ignoredCount})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 overflow-x-auto rounded-[var(--radius)] border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                          Data
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                          ID do Pedido
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                          Valor dos Itens
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidos
                        .filter((r) => r.status.toUpperCase() !== 'CONCLUIDO')
                        .map((r, idx) => (
                          <tr
                            key={`ig-${r.orderId}-${idx}`}
                            className="border-t border-border bg-muted/30"
                          >
                            <td className="whitespace-nowrap px-2 py-2 text-muted-foreground tabular-nums">
                              {r.date ? formatDateTime(r.date) : '—'}
                            </td>
                            <td
                              className="max-w-[140px] truncate px-2 py-2 text-muted-foreground"
                              title={r.orderId}
                            >
                              {r.orderId}
                            </td>
                            <td className="px-2 py-2 text-muted-foreground">{r.status || '—'}</td>
                            <td className="whitespace-nowrap px-2 py-2 text-right text-muted-foreground tabular-nums">
                              {formatBRL(r.itemsValue)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </section>

        {/* STEP 2 */}
        {step1Done && (
          <>
            <Separator />
            <section className="flex flex-col gap-3" aria-labelledby="step2-title">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <h3 id="step2-title" className="text-sm font-semibold text-foreground">
                  Passo 2 — Importar Itens (Estoque)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Opcional. Selecione o relatório de cardápio para descontar insumos do estoque. Os
                itens são agregados por período, não por pedido.
              </p>

              <FileDropzone
                label="Selecionar relatório de cardápio"
                disabled={cardapioImporting || step2Done}
                parsing={cardapioStatus === 'parsing'}
                fileName={cardapioFile?.name ?? null}
                error={cardapioError}
                onFile={(f) => void parseCardapio(f)}
                onClear={() => {
                  setCardapioFile(null)
                  setCardapioStatus('idle')
                  setCardapioError(null)
                  setCardapio([])
                }}
              />

              {cardapioStatus === 'success' && cardapio.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={allMatchedChecked}
                        onCheckedChange={(v) => toggleAllMatched(v === true)}
                        aria-label="Selecionar todos"
                        disabled={matchedCardapio.length === 0}
                      />
                      Selecionar todos
                    </label>
                    {unmatchedCardapio.length > 0 && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={allUnmatchedChecked}
                          onCheckedChange={(v) => toggleAllUnmatched(v === true)}
                          aria-label="Selecionar todos não cadastrados"
                        />
                        Selecionar todos não cadastrados
                      </label>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                            Importar
                          </th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                            Item do Cardápio
                          </th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                            Produto Cadastrado
                          </th>
                          <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                            Quantidade Vendida
                          </th>
                          <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                            Valor Total
                          </th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cardapio.map((r, idx) => (
                          <tr key={`card-${idx}`} className="border-t border-border">
                            <td className="px-2 py-2">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={r.selected}
                                  onCheckedChange={() => toggleCardapio(r.itemName)}
                                  aria-label={`Importar item ${r.itemName}`}
                                />
                              </div>
                            </td>
                            <td
                              className="max-w-[180px] truncate px-2 py-2 text-foreground"
                              title={r.itemName}
                            >
                              {r.itemName}
                            </td>
                            <td className="px-2 py-2">
                              {r.matchedProduct ? (
                                <span className="text-foreground">{r.matchedProduct.name}</span>
                              ) : (
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="cursor-help text-left text-muted-foreground underline decoration-dotted underline-offset-2"
                                      >
                                        {r.itemName}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Este produto será criado automaticamente com o nome e preço do
                                      iFood.
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-right text-foreground tabular-nums">
                              {r.quantity}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-right text-foreground tabular-nums">
                              {formatBRL(r.totalValue)}
                            </td>
                            <td className="px-2 py-2">
                              {r.matchedProduct ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : (
                                <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10">
                                  <PlusCircle className="h-3.5 w-3.5" />
                                  Criar produto
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {matchedCardapio.length} itens correspondem a produtos cadastrados.{' '}
                    {selectedUnmatchedCardapio.length} itens serão criados automaticamente.{' '}
                    {uncheckedUnmatchedCardapio.length} itens sem correspondência (desmarcados).
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Os itens serão importados como uma venda consolidada de ajuste de estoque (sem
                    impacto na receita).
                  </p>

                  {cardapioImporting && (
                    <div className="flex flex-col gap-1.5">
                      <Progress value={cardapioProgress} />
                      <p className="text-xs text-muted-foreground">
                        {cardapioProgress < 50 && selectedUnmatchedCardapio.length > 0
                          ? `Criando ${selectedUnmatchedCardapio.length} produtos...`
                          : 'Importando itens...'}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      className="h-11 gap-2"
                      disabled={selectedCardapio.length === 0 || cardapioImporting || step2Done}
                      onClick={() => void handleImportCardapio()}
                    >
                      {cardapioImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <Package className="h-4 w-4" />
                          Importar Itens
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {step2Done && (
                <p className="flex items-center gap-1.5 text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  Estoque ajustado com sucesso.
                </p>
              )}
            </section>
          </>
        )}

        {/* Footer */}
        <Separator />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {step1Done ? (
            <Button type="button" className="h-11 gap-2" onClick={() => handleOpenChange(false)}>
              <Check className="h-4 w-4" />
              {step2Done ? 'Concluir' : 'Concluir'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Product matching                                                    */
/* ------------------------------------------------------------------ */

function matchProduct(itemName: string, products: Product[]): Product | null {
  const name = (itemName || '').trim().toLowerCase()
  if (!name) return null

  // Exact (case-insensitive, trimmed) match.
  const exact = products.find((p) => p.name.trim().toLowerCase() === name)
  if (exact) return exact

  // Fuzzy: containment either way.
  const fuzzy = products.find(
    (p) => p.name.trim().toLowerCase().includes(name) || name.includes(p.name.trim().toLowerCase()),
  )
  return fuzzy ?? null
}

export default IfoodImportDialog
