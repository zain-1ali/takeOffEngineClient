import { useMemo, useState } from 'react'
import type { Project } from '../../types/api'
import { GridPreview, type GridSelection } from '../../grid/GridPreview'
import { spanLengthBetween } from '../../grid/gridMath'
import { lengthToDisplay, parseUnitSystem } from '../../lib/units'
import { GhostButton, PrimaryButton } from '../ui'
import { Modal } from './Modal'

export type PointPlacementResult = {
  mode: 'point'
  gridX: string
  gridY: string
  gridRef: string
}

export type SpanPlacementResult = {
  mode: 'span'
  gridStart: string
  gridEnd: string
  lengthM: number
  start: GridSelection
  end: GridSelection
}

type Props = {
  open: boolean
  onClose: () => void
  project: Project
  mode: 'point' | 'span'
  title: string
  cancelLabel?: string
  confirmLabel?: string
  onConfirm: (result: PointPlacementResult | SpanPlacementResult) => void
}

export function GridPlacementModal({
  open,
  onClose,
  project,
  mode,
  title,
  cancelLabel = 'Cancel',
  confirmLabel,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<GridSelection | null>(null)
  const [start, setStart] = useState<GridSelection | null>(null)
  const [end, setEnd] = useState<GridSelection | null>(null)

  const unitSystem = parseUnitSystem(project.units)
  const lengthUnit = unitSystem === 'imperial' ? 'ft' : 'm'

  const lengthM = useMemo(() => {
    if (mode !== 'span' || !start || !end) return null
    return spanLengthBetween(
      project.grid,
      start.gridX,
      start.gridY,
      end.gridX,
      end.gridY,
    )
  }, [mode, start, end, project.grid])

  function reset() {
    setSelected(null)
    setStart(null)
    setEnd(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSelect(point: GridSelection) {
    if (mode === 'point') {
      setSelected(point)
      return
    }
    if (!start || (start && end)) {
      setStart(point)
      setEnd(null)
      return
    }
    if (point.gridRef === start.gridRef) return
    setEnd(point)
  }

  const canConfirm =
    mode === 'point'
      ? !!selected
      : !!start && !!end && lengthM != null && lengthM > 0

  return (
    <Modal open={open} title={title} onClose={handleClose} wide>
      <p className="text-xs text-steel mb-3">
        {mode === 'point'
          ? 'Click a grid intersection to place this instance. Manual dimension entry remains available if you cancel.'
          : 'Click a start intersection, then an end intersection. Length is computed from orthogonal-grid spacings (including Euclidean diagonals).'}
      </p>
      <GridPreview
        grid={project.grid}
        mode={mode}
        selected={selected}
        start={start}
        end={end}
        onSelect={handleSelect}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-mono text-ink">
        {mode === 'point' && (
          <span>
            Selected:{' '}
            <span className="text-signal-text">{selected?.gridRef ?? '—'}</span>
          </span>
        )}
        {mode === 'span' && (
          <>
            <span>
              Start:{' '}
              <span className="text-signal-text">{start?.gridRef ?? '—'}</span>
            </span>
            <span>
              End:{' '}
              <span className="text-signal-text">{end?.gridRef ?? '—'}</span>
            </span>
            <span>
              Length:{' '}
              <span className="text-signal-text">
                {lengthM != null
                  ? `${lengthToDisplay(lengthM, unitSystem).toFixed(2)} ${lengthUnit}`
                  : '—'}
              </span>
            </span>
          </>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton className="!text-sm !py-1.5 !px-4" onClick={handleClose}>
          {cancelLabel}
        </GhostButton>
        <PrimaryButton
          className="!text-sm !py-1.5 !px-4"
          disabled={!canConfirm}
          onClick={() => {
            if (mode === 'point' && selected) {
              onConfirm({
                mode: 'point',
                gridX: selected.gridX,
                gridY: selected.gridY,
                gridRef: selected.gridRef,
              })
              reset()
              return
            }
            if (mode === 'span' && start && end && lengthM != null) {
              onConfirm({
                mode: 'span',
                gridStart: start.gridRef,
                gridEnd: end.gridRef,
                lengthM,
                start,
                end,
              })
              reset()
            }
          }}
        >
          {confirmLabel || (mode === 'point' ? 'Place instance' : 'Use grid length')}
        </PrimaryButton>
      </div>
    </Modal>
  )
}
