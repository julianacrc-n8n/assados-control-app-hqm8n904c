/**
 * Locale-aware formatting helpers (pt-BR).
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Format a number as Brazilian Real, e.g. 12.5 -> "R$ 12,50". */
export function formatBRL(value: number): string {
  if (!Number.isFinite(value)) return 'R$ 0,00'
  return BRL.format(value)
}

/** Format a decimal quantity using pt-BR rules, e.g. 0.5 -> "0,5". */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 3,
  }).format(value)
}
