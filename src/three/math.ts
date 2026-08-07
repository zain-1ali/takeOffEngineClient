/**
 * Shared math used by 3D builders — same formula as the HTML prototype
 * (and backend engines/math.ts).
 */
export function barCountForSpan(spanM: number, spacingMm: number): number {
  return Math.floor(spanM / (spacingMm / 1000)) + 1;
}
