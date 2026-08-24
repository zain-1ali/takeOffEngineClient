import { useEffect, useMemo, useState } from 'react'
import {
  emptyOpeningRow,
  OPENING_PRESETS,
  OPENING_TYPES,
  openingRowArea,
  openingsTotalArea,
  parseOpenings,
  roundOpeningArea,
  type OpeningRow,
  type OpeningType,
} from '../../lib/openings'
import {
  lengthFromDisplay,
  lengthToDisplay,
  type UnitSystem,
} from '../../lib/units'
import { GhostButton, NumericInput, PrimaryButton } from '../ui'
import { Modal } from './Modal'

const inputCls =
  'w-full border border-steel-border bg-panel-hover px-2 py-1 text-xs font-mono text-ink outline-none'

function cloneRows(rows: OpeningRow[]): OpeningRow[] {
  return rows.map((r) => ({ ...r }))
}

export type OpeningsTableConfirm = {
  openings: OpeningRow[]
  /** Sum of W×H×count (m²), rounded. */
  openingArea: number
}

/**
 * Generic openings breakdown modal — not tied to Wall Finish.
 * Confirm writes rows + summed openingArea back to the caller.
 */
export function OpeningsTableModal({
  open,
  onClose,
  onConfirm,
  openings,
  openingArea,
  unitSystem = 'metric',
  title = 'Openings',
}: {
  open: boolean
  onClose: () => void
  onConfirm: (result: OpeningsTableConfirm) => void
  openings?: OpeningRow[] | unknown
  /** Legacy / current total when no rows yet. */
  openingArea?: number | null
  unitSystem?: UnitSystem
  title?: string
}) {
  const [rows, setRows] = useState<OpeningRow[]>([])

  useEffect(() => {
    if (!open) return
    const parsed = parseOpenings(openings)
    setRows(parsed.length ? cloneRows(parsed) : [])
  }, [open, openings])

  const total = useMemo(() => roundOpeningArea(openingsTotalArea(rows)), [rows])
  const legacyTotal =
    openingArea != null && Number.isFinite(Number(openingArea))
      ? Number(openingArea)
      : null
  const showLegacyHint =
    rows.length === 0 && legacyTotal != null && legacyTotal > 0

  const lenLabel = unitSystem === 'imperial' ? 'ft' : 'm'

  function updateRow(id: string, patch: Partial<OpeningRow>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )
  }

  function applyTypeOrPreset(id: string, value: string) {
    const preset = OPENING_PRESETS.find((p) => `preset:${p.id}` === value)
    if (preset) {
      updateRow(id, {
        type: preset.type,
        width: preset.width,
        height: preset.height,
      })
      return
    }
    if ((OPENING_TYPES as readonly string[]).includes(value)) {
      updateRow(id, { type: value as OpeningType })
    }
  }

  function addRow() {
    setRows((prev) => [...prev, emptyOpeningRow()])
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  function handleConfirm() {
    const cleaned = rows
      .map((r) => ({
        ...r,
        width: Math.max(0, Number(r.width) || 0),
        height: Math.max(0, Number(r.height) || 0),
        count: Math.max(0, Math.floor(Number(r.count) || 0)),
      }))
      .filter((r) => r.count > 0 && (r.width > 0 || r.height > 0))
    onConfirm({
      openings: cleaned,
      openingArea: roundOpeningArea(openingsTotalArea(cleaned)),
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="xl">
      <p className="text-[11px] text-steel mb-3 leading-relaxed">
        Enter each opening (type, size, count). Area = width × height × count.
        Confirm writes the breakdown and the total into the Opng field.
      </p>

      {showLegacyHint && (
        <p className="text-[11px] text-signal mb-3 leading-relaxed">
          Current Opng total is {legacyTotal!.toFixed(2)} m² with no saved
          breakdown. Add rows below to replace it, or confirm empty to clear.
        </p>
      )}

      <div className="border border-steel-border overflow-auto max-h-[50vh]">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-panel-hover text-steel uppercase tracking-wide">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium min-w-[11rem]">
                Type / preset
              </th>
              <th className="text-right px-2 py-1.5 font-medium w-24">
                Width ({lenLabel})
              </th>
              <th className="text-right px-2 py-1.5 font-medium w-24">
                Height ({lenLabel})
              </th>
              <th className="text-right px-2 py-1.5 font-medium w-16">Count</th>
              <th className="text-right px-2 py-1.5 font-medium w-24">
                Area (m²)
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-2 py-6 text-center text-steel"
                >
                  No openings yet. Add a row or pick a standard size.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const area = roundOpeningArea(openingRowArea(row))
              return (
                <tr key={row.id} className="border-t border-steel-border">
                  <td className="px-2 py-1">
                    <select
                      className={inputCls}
                      value={row.type}
                      onChange={(e) => applyTypeOrPreset(row.id, e.target.value)}
                    >
                      <optgroup label="Type">
                        {OPENING_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Standard sizes">
                        {OPENING_PRESETS.map((p) => (
                          <option key={p.id} value={`preset:${p.id}`}>
                            {p.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <NumericInput
                      min={0}
                      className={`${inputCls} text-right`}
                      value={lengthToDisplay(row.width, unitSystem)}
                      emptyValue={0}
                      showError={false}
                      onChange={(n) => {
                        updateRow(row.id, {
                          width:
                            n != null && Number.isFinite(n)
                              ? lengthFromDisplay(n, unitSystem)
                              : 0,
                        })
                      }}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <NumericInput
                      min={0}
                      className={`${inputCls} text-right`}
                      value={lengthToDisplay(row.height, unitSystem)}
                      emptyValue={0}
                      showError={false}
                      onChange={(n) => {
                        updateRow(row.id, {
                          height:
                            n != null && Number.isFinite(n)
                              ? lengthFromDisplay(n, unitSystem)
                              : 0,
                        })
                      }}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <NumericInput
                      min={0}
                      integer
                      className={`${inputCls} text-right`}
                      value={row.count}
                      emptyValue={0}
                      showError={false}
                      onChange={(n) => {
                        updateRow(row.id, {
                          count: n != null && Number.isFinite(n) ? Math.max(0, n) : 0,
                        })
                      }}
                    />
                  </td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums text-ink">
                    {area.toFixed(2)}
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      className="text-danger text-sm px-1"
                      aria-label="Remove opening"
                      onClick={() => removeRow(row.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-steel-border bg-panel-hover">
              <td colSpan={4} className="px-2 py-2 font-semibold text-ink">
                Total openings
              </td>
              <td className="px-2 py-2 text-right font-mono font-semibold tabular-nums text-ink">
                {total.toFixed(2)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <GhostButton className="!text-xs !py-1.5 !px-3" onClick={addRow}>
          + Add opening
        </GhostButton>
        <div className="flex gap-2">
          <GhostButton className="!text-xs !py-1.5 !px-3" onClick={onClose}>
            Cancel
          </GhostButton>
          <PrimaryButton className="!text-xs !py-1.5 !px-3" onClick={handleConfirm}>
            Confirm · {total.toFixed(2)} m²
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  )
}
