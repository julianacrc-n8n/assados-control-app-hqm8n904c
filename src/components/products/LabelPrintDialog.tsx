import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import JsBarcode from 'jsbarcode'
import { Barcode, Info, PackageSearch, Printer, Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

type PrintFormat = 'a4' | 'roll80'

interface LabelPrintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  loading: boolean
}

const A4_LABELS_PER_PAGE = 30 // 3 columns × 10 rows

export function LabelPrintDialog({ open, onOpenChange, products, loading }: LabelPrintDialogProps) {
  const isMobile = useIsMobile()

  const [printFormat, setPrintFormat] = useState<PrintFormat>('a4')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [previewTick, setPreviewTick] = useState(0)

  // Products that have a usable barcode vs those without.
  const withBarcode = useMemo(
    () =>
      products
        .filter((p) => p.barcode != null && p.barcode.trim().length > 0)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  )
  const withoutBarcode = useMemo(
    () =>
      products
        .filter((p) => p.barcode == null || p.barcode.trim().length === 0)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  )

  // Reset selection whenever the dialog (re)opens or the source list changes
  // in a way that would invalidate ids. When opening, default to all selected.
  useEffect(() => {
    if (!open) return
    const ids = withBarcode.map((p) => p.id)
    setSelected(new Set(ids))
    const initialQty: Record<string, number> = {}
    for (const id of ids) initialQty[id] = 1
    setQuantities(initialQty)
  }, [open, withBarcode])

  const allSelected = withBarcode.length > 0 && selected.size === withBarcode.length

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(withBarcode.map((p) => p.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setQty(id: string, value: number) {
    const clamped = Math.max(1, Math.min(100, Math.floor(value || 1)))
    setQuantities((prev) => ({ ...prev, [id]: clamped }))
  }

  // Build the flat list of labels (one entry per label to print, including
  // duplicates for quantity) for the preview + the popup.
  const labels = useMemo(() => {
    const out: { productName: string; barcode: string; price: number }[] = []
    for (const p of withBarcode) {
      if (!selected.has(p.id)) continue
      const qty = Math.max(1, quantities[p.id] ?? 1)
      for (let i = 0; i < qty; i++) {
        out.push({ productName: p.name, barcode: p.barcode as string, price: p.price })
      }
    }
    return out
  }, [withBarcode, selected, quantities])

  const totalLabels = labels.length
  const totalPages =
    printFormat === 'a4' ? Math.max(1, Math.ceil(totalLabels / A4_LABELS_PER_PAGE)) : 1

  const previewLabels = useMemo(() => {
    const limit = printFormat === 'a4' ? A4_LABELS_PER_PAGE : 6
    return labels.slice(0, limit)
  }, [labels, printFormat])

  // Re-render preview barcodes whenever inputs change.
  useEffect(() => {
    setPreviewTick((t) => t + 1)
  }, [previewLabels, printFormat])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[95vh] flex-col gap-0 p-0 sm:max-w-[800px]',
          isMobile &&
            'left-0 top-0 h-full max-h-[100vh] w-full translate-x-0 translate-y-0 rounded-none',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-foreground" />
            <div>
              <DialogTitle id="label-print-title" className="text-lg font-semibold">
                Imprimir Etiquetas
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Gere etiquetas de código de barras para impressão.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Section 1 — Print Format Selector */}
          <section aria-labelledby="format-label" className="mb-6">
            <div id="format-label" className="mb-2 flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Formato de Impressão</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <FormatButton
                active={printFormat === 'a4'}
                onClick={() => setPrintFormat('a4')}
                title="A4 (Folha)"
                description="3 colunas × 10 linhas · 30 etiquetas por página"
              />
              <FormatButton
                active={printFormat === 'roll80'}
                onClick={() => setPrintFormat('roll80')}
                title="Bobina 80mm"
                description="Coluna única · 80mm × 30mm · impressora térmica"
              />
            </div>
          </section>

          {/* Section 2 — Product Selection */}
          <section aria-labelledby="select-label" className="mb-6">
            <div id="select-label" className="mb-2 flex items-center gap-2">
              <PackageSearch className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Selecionar Produtos</span>
            </div>

            {loading ? (
              <ProductSelectionSkeleton />
            ) : withBarcode.length === 0 ? (
              <EmptyBarcodeState />
            ) : (
              <>
                <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos os produtos"
                  />
                  Selecionar Todos
                </label>

                <div className="max-h-[400px] overflow-y-auto rounded-[var(--radius)] border border-border">
                  <ul className="divide-y divide-border">
                    {withBarcode.map((p) => (
                      <li
                        key={p.id}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5',
                          selected.has(p.id) ? 'bg-background' : 'bg-muted/30',
                        )}
                      >
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={() => toggleOne(p.id)}
                          aria-label={`Selecionar ${p.name}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {p.barcode}
                          </p>
                        </div>
                        <span className="shrink-0 text-right font-semibold tabular-nums text-foreground">
                          {formatBRL(p.price)}
                        </span>
                        <div className="flex shrink-0 flex-col items-center gap-0.5">
                          <label className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                            Qtd
                          </label>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            step={1}
                            value={quantities[p.id] ?? 1}
                            onChange={(e) => setQty(p.id, Number(e.target.value))}
                            disabled={!selected.has(p.id)}
                            aria-label={`Quantidade de etiquetas para ${p.name}`}
                            className={cn(
                              'h-8 rounded-md border-border text-center text-sm',
                              isMobile ? 'w-[60px]' : 'w-[80px]',
                            )}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {withoutBarcode.length > 0 && (
                  <div className="mt-4 rounded-[var(--radius)] border border-dashed border-border bg-muted/20 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      Produtos sem código de barras ({withoutBarcode.length})
                    </p>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Produtos sem código de barras não podem ter etiquetas geradas. Edite o produto
                      para adicionar um código de barras.
                    </p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {withoutBarcode.map((p) => (
                        <li key={p.id} className="text-xs text-muted-foreground/70">
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Section 3 — Preview and Print */}
          <section aria-labelledby="preview-label" className="mb-2">
            <div id="preview-label" className="mb-2 flex items-center gap-2">
              <Barcode className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Pré-visualização</span>
            </div>

            {loading ? (
              <div className="flex h-40 animate-pulse items-center justify-center rounded-[var(--radius)] border border-border bg-muted/30">
                <span className="text-sm text-muted-foreground">Carregando pré-visualização…</span>
              </div>
            ) : totalLabels === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-[var(--radius)] border border-dashed border-border bg-muted/20 text-center text-sm text-muted-foreground">
                Selecione produtos para visualizar as etiquetas.
              </div>
            ) : (
              <PreviewArea
                key={previewTick}
                labels={previewLabels}
                format={printFormat}
                isMobile={isMobile}
              />
            )}

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>
                Total de etiquetas: <strong className="text-foreground">{totalLabels}</strong>
              </span>
              <span>
                Total de páginas: <strong className="text-foreground">{totalPages}</strong>
              </span>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="h-11 px-6 font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="h-12 gap-2 font-semibold sm:w-auto"
            disabled={loading || totalLabels === 0}
            onClick={() => openLabelPrintWindow(labels, printFormat)}
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Format button ---------------- */

function FormatButton({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean
  onClick: () => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-1 items-start gap-3 rounded-[var(--radius)] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'border-ring bg-ring/5 ring-1 ring-ring'
          : 'border-border bg-background hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          active ? 'border-ring' : 'border-muted-foreground/40',
        )}
      >
        {active && <span className="h-2 w-2 rounded-full bg-ring" />}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

/* ---------------- Preview ---------------- */

function PreviewArea({
  labels,
  format,
  isMobile,
}: {
  labels: { productName: string; barcode: string; price: number }[]
  format: PrintFormat
  isMobile: boolean
}) {
  const refs = useRef<Record<number, SVGSVGElement | null>>({})

  useEffect(() => {
    for (const [idx, svg] of Object.entries(refs.current)) {
      if (!svg) continue
      const label = labels[Number(idx)]
      if (!label) continue
      try {
        JsBarcode(svg, label.barcode, {
          format: 'CODE128',
          width: 2,
          height: format === 'a4' ? 30 : 28,
          fontSize: 0,
          margin: 0,
          displayValue: false,
        })
      } catch {
        // Render fallback manually.
        svg.innerHTML = ''
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.setAttribute('x', '50%')
        text.setAttribute('y', '50%')
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('dominant-baseline', 'middle')
        text.setAttribute('font-size', '8')
        text.setAttribute('fill', '#999')
        text.textContent = 'Código inválido'
        svg.appendChild(text)
      }
    }
  }, [labels, format])

  if (format === 'a4') {
    return (
      <div
        className={cn(
          'overflow-auto rounded-[var(--radius)] border border-border bg-white p-3',
          isMobile ? 'max-h-[260px]' : 'max-h-[360px]',
        )}
      >
        <div className="mx-auto grid w-full grid-cols-3 gap-1.5">
          {labels.map((label, idx) => (
            <PreviewLabel key={idx} label={label} idx={idx} refs={refs} variant="a4" />
          ))}
        </div>
        {labels.length >= A4_LABELS_PER_PAGE && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Mostrando a primeira página de etiquetas.
          </p>
        )}
      </div>
    )
  }

  // 80mm roll — single column.
  return (
    <div className="overflow-auto rounded-[var(--radius)] border border-border bg-white p-3 max-h-[360px]">
      <div className="mx-auto flex w-full max-w-[220px] flex-col gap-1.5">
        {labels.map((label, idx) => (
          <PreviewLabel key={idx} label={label} idx={idx} refs={refs} variant="roll80" />
        ))}
      </div>
    </div>
  )
}

const PreviewLabel = ({
  label,
  idx,
  refs,
  variant,
}: {
  label: { productName: string; barcode: string; price: number }
  idx: number
  refs: React.MutableRefObject<Record<number, SVGSVGElement | null>>
  variant: 'a4' | 'roll80'
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center border border-dashed border-[#999] px-1.5 py-1',
        variant === 'a4' ? 'aspect-[63/25]' : 'aspect-[76/25] w-full',
      )}
    >
      <p className="line-clamp-2 w-full text-center text-[7px] font-semibold leading-tight text-black">
        {label.productName}
      </p>
      <svg
        ref={(el) => {
          refs.current[idx] = el
        }}
        className="my-0.5 h-7 w-full max-w-[120px]"
      />
      <p className="text-center font-mono text-[6px] text-black">{label.barcode}</p>
      <p className="text-center text-[8px] font-bold text-black">{formatBRL(label.price)}</p>
    </div>
  )
}

/* ---------------- Skeleton / Empty ---------------- */

function ProductSelectionSkeleton() {
  return (
    <div className="rounded-[var(--radius)] border border-border p-3">
      <Skeleton className="mb-3 h-5 w-32" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <div className="flex-1">
              <Skeleton className="mb-1 h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-[80px] rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyBarcodeState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <Barcode className="h-10 w-10 text-muted-foreground" />
      <h3 className="mt-3 text-sm font-semibold text-foreground">
        Nenhum produto com código de barras
      </h3>
      <p className="mt-1 max-w-[320px] text-xs text-muted-foreground">
        Cadastre produtos com código de barras para gerar etiquetas.
      </p>
    </div>
  )
}

/* ---------------- Print popup ---------------- */

interface LabelData {
  productName: string
  barcode: string
  price: number
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function priceBR(value: number): string {
  return formatBRL(value)
}

function openLabelPrintWindow(labels: LabelData[], format: PrintFormat): void {
  if (labels.length === 0) return

  const labelsJson = JSON.stringify(
    labels.map((l) => ({
      productName: l.productName,
      barcode: l.barcode,
      price: priceBR(l.price),
    })),
  )

  const pageCss =
    format === 'a4'
      ? `@page { size: A4; margin: 8mm; }
         body { width: auto; }
         .labels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; padding: 0; }
         .label { width: 63mm; height: 25mm; }
         .label svg { width: 50mm; height: 12mm; }
         .page-break { break-after: page; page-break-after: always; }`
      : `@page { size: 80mm auto; margin: 2mm; }
         body { width: 80mm; }
         .labels { display: flex; flex-direction: column; gap: 2mm; padding: 0; }
         .label { width: 76mm; height: 25mm; margin-bottom: 2mm; }
         .label svg { width: 65mm; height: 12mm; }
         .page-break { display: none; }`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Imprimir Etiquetas</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"></script>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    color: black;
    background: white;
  }
  ${pageCss}
  .label {
    border: 0.5px dashed #999999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1mm;
    overflow: hidden;
  }
  .label .name {
    font-size: 9px;
    font-weight: 600;
    text-align: center;
    max-height: 2.4em;
    overflow: hidden;
    width: 100%;
    line-height: 1.2;
  }
  .label .code {
    font-size: 8px;
    font-family: monospace;
    text-align: center;
    margin-top: 0.5mm;
  }
  .label .price {
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    margin-top: 0.5mm;
  }
  .invalid {
    border: 1px solid #ccc;
    color: #999;
    font-size: 8px;
    text-align: center;
    padding: 2mm;
  }
</style>
</head>
<body>
  <div class="labels" id="labels"></div>
<script>
  var LABELS = ${labelsJson};
  var container = document.getElementById('labels');
  var perPage = ${format === 'a4' ? A4_LABELS_PER_PAGE : 0};

  LABELS.forEach(function (label, i) {
    var div = document.createElement('div');
    div.className = 'label';
    div.innerHTML =
      '<div class="name">' + escape(label.productName) + '</div>' +
      '<svg></svg>' +
      '<div class="code">' + escape(label.barcode) + '</div>' +
      '<div class="price">' + escape(label.price) + '</div>';
    var svg = div.querySelector('svg');
    svg.setAttribute('data-barcode', label.barcode);
    container.appendChild(div);

    // Page break after every perPage labels (A4 only).
    if (perPage > 0 && (i + 1) % perPage === 0 && i < LABELS.length - 1) {
      var brk = document.createElement('div');
      brk.className = 'page-break';
      container.appendChild(brk);
    }
  });

  function escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderBarcodes() {
    var svgs = container.querySelectorAll('svg');
    svgs.forEach(function (svg) {
      var code = svg.getAttribute('data-barcode');
      try {
        if (typeof JsBarcode === 'undefined') throw new Error('JsBarcode not loaded');
        JsBarcode(svg, code, {
          format: 'CODE128',
          width: 2,
          height: 40,
          fontSize: 0,
          margin: 0,
          displayValue: false
        });
      } catch (e) {
        var parent = svg.parentNode;
        var fallback = document.createElement('div');
        fallback.className = 'invalid';
        fallback.textContent = 'Código inválido';
        parent.replaceChild(fallback, svg);
      }
    });
  }

  window.addEventListener('load', function () {
    renderBarcodes();
    setTimeout(function () { window.print(); }, 500);
  });
  window.addEventListener('afterprint', function () { window.close(); });
</script>
</body>
</html>`

  const printWin = window.open('', '_blank', 'width=900,height=700')
  if (!printWin) {
    toast.error('Não foi possível abrir a janela de impressão. Permita popups para este site.')
    return
  }
  printWin.document.open()
  printWin.document.write(html)
  printWin.document.close()

  toast.success('Abrindo janela de impressão...')
}
