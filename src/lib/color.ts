/**
 * Color helpers for white-label theming.
 *
 * The shadcn/ui theme uses HSL custom properties stored as space-separated
 * triplets (e.g. `32 75% 42%`). These helpers convert a hex color (set by the
 * store in the Settings page) into that HSL triplet so it can be applied to
 * `--primary` (and related properties) on `document.documentElement`.
 */

export interface HSL {
  /** Hue 0–360 */
  h: number
  /** Saturation 0–100 (percent) */
  s: number
  /** Lightness 0–100 (percent) */
  l: number
}

/**
 * Convert a hex color string (#RGB, #RGBA, #RRGGBB or #RRGGBBAA) to an HSL
 * object. Returns null for invalid input.
 */
export function hexToHSL(hex: string): HSL | null {
  if (!hex || typeof hex !== 'string') return null
  const m = hex.trim().replace(/^#/, '')
  let r = 0
  let g = 0
  let b = 0
  let a = 1

  if (m.length === 3) {
    r = parseInt(m[0] + m[0], 16)
    g = parseInt(m[1] + m[1], 16)
    b = parseInt(m[2] + m[2], 16)
  } else if (m.length === 4) {
    r = parseInt(m[0] + m[0], 16)
    g = parseInt(m[1] + m[1], 16)
    b = parseInt(m[2] + m[2], 16)
    a = parseInt(m[3] + m[3], 16) / 255
  } else if (m.length === 6) {
    r = parseInt(m.slice(0, 2), 16)
    g = parseInt(m.slice(2, 4), 16)
    b = parseInt(m.slice(4, 6), 16)
  } else if (m.length === 8) {
    r = parseInt(m.slice(0, 2), 16)
    g = parseInt(m.slice(2, 4), 16)
    b = parseInt(m.slice(4, 6), 16)
    a = parseInt(m.slice(6, 8), 16) / 255
  } else {
    return null
  }
  if ([r, g, b].some((n) => Number.isNaN(n))) return null

  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  if (delta !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6
        break
      case g:
        h = (b - r) / delta + 2
        break
      default:
        h = (r - g) / delta + 4
        break
    }
    h *= 60
    if (h < 0) h += 360
  }

  // alpha unused for HSL triplet but kept for completeness
  void a

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/** Format an HSL object as a shadcn-style space-separated triplet string. */
export function hslToString(hsl: HSL): string {
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`
}

/**
 * Decide an appropriate foreground color (dark or light) for a given HSL
 * background, using relative luminance. Returns the shadcn triplet for a
 * near-white or near-black foreground so text stays legible on `--primary`.
 */
export function foregroundForHSL(hsl: HSL): string {
  // Convert HSL to RGB for luminance calculation.
  const h = hsl.h / 360
  const s = hsl.s / 100
  const l = hsl.l / 100
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hue2rgb(p, q, h + 1 / 3)
  const g = hue2rgb(p, q, h)
  const b = hue2rgb(p, q, h - 1 / 3)
  // Relative luminance (sRGB).
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // Dark backgrounds → light foreground, light backgrounds → dark foreground.
  return luminance > 0.55 ? '30 15% 15%' : '40 30% 98%'
}
