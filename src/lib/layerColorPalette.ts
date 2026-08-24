/** Curated layer swatches — distinct on white/light blueprints (no pure white). */
export const LAYER_PALETTE_SWATCHES = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#ea580c',
  '#be185d',
  '#4f46e5',
  '#0d9488',
  '#b45309',
  '#7c3aed',
  '#1d4ed8',
  '#c2410c',
  '#15803d',
  '#334155',
] as const

export const DEFAULT_GENERAL_LAYER_COLOR = LAYER_PALETTE_SWATCHES[0]

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR.test(value.trim())
}
