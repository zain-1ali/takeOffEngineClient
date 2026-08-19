/**
 * When a rebar schedule column should be inactive for this instance
 * (still occupies the column so the table stays aligned).
 */
export function rebarFieldInactiveReason(
  elementKey: string,
  fieldKey: string,
  shape: string,
  reinforcement: Record<string, unknown> | null | undefined,
): string | null {
  const topOn = reinforcement?.topMeshEnabled === true
  const isTopMeshField =
    fieldKey === 'topMainBars' || fieldKey === 'topDistBars'

  if (isTopMeshField) {
    if (elementKey === 'PAD_FOOTING' || elementKey === 'STRIP_FOOTING') {
      if (!topOn) return 'Enable Top mesh to edit'
    }
    if (elementKey === 'SLABS' && shape !== 'DROP_PANEL') {
      return 'Top mesh applies to drop-panel slabs'
    }
  }

  if (fieldKey === 'ribBarsPerRib' && elementKey === 'SLABS' && shape !== 'WAFFLE') {
    return 'Bars/rib applies to waffle slabs'
  }

  return null
}
