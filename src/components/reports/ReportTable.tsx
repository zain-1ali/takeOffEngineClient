import { useEffect, useState } from 'react'
import { formatMoney } from '../../lib/units'
import type { ReportLine } from '../../types/reports'
import { DataTable, NumericInput } from '../ui'

function fmtQty(qty: number | undefined, line: ReportLine): string {
  if (qty == null || Number.isNaN(qty)) return '—'
  const dec =
    line.dec ??
    (line.unit === 't' ? 3 : line.unit === 'bags' || line.unit === 'L' || line.unit === 'nos' ? 1 : 2)
  if (line.unit === 'nos' || (line.dec === 0 && Number.isInteger(qty))) return String(Math.round(qty))
  return qty.toFixed(dec === 0 ? 0 : dec)
}

export function ReportTable({
  lines,
  currency,
  emptyMessage = 'No quantities to bill.',
  onQtyChange,
  onFollowInputs,
  onDeleteLine,
  onRateClick,
  onDescriptionChange,
}: {
  lines: ReportLine[]
  currency: string
  emptyMessage?: string
  /** Type a qty directly in the table (does not open takeoff). */
  onQtyChange?: (line: ReportLine, quantity: number) => void
  /** Clear TYPED override so a bound line follows Take off Inputs again. */
  onFollowInputs?: (line: ReportLine) => void
  /** Remove a manual BOQ line. */
  onDeleteLine?: (line: ReportLine) => void
  /** Open pack RATE ANALYSIS for this line. */
  onRateClick?: (line: ReportLine) => void
  /** Persist an editable BOQ item description. */
  onDescriptionChange?: (line: ReportLine, description: string) => void
}) {
  if (!lines.length) {
    return <p className="text-sm text-steel py-4">{emptyMessage}</p>
  }

  return (
    <div className="panel-card !p-0 overflow-hidden">
      <DataTable compact>
        <DataTable.Header>
          <DataTable.Row>
            <DataTable.HeaderCell className="w-12 !py-1.5 text-[11px]">
              Ref
            </DataTable.HeaderCell>
            <DataTable.HeaderCell className="!py-1.5 text-[11px]">
              Description
            </DataTable.HeaderCell>
            <DataTable.HeaderCell
              align="right"
              className="w-36 !py-1.5 text-[11px]"
              title="Type a quantity in the cell. Bound lines follow Take off Inputs until you type."
            >
              Qty
            </DataTable.HeaderCell>
            <DataTable.HeaderCell className="w-10 !py-1.5 text-[11px]">
              Unit
            </DataTable.HeaderCell>
            <DataTable.HeaderCell align="right" className="w-20 !py-1.5 text-[11px]">
              Rate
            </DataTable.HeaderCell>
            <DataTable.HeaderCell align="right" className="w-24 !py-1.5 text-[11px]">
              Amount
            </DataTable.HeaderCell>
            {onDeleteLine ? (
              <DataTable.HeaderCell className="w-8 !py-1.5 text-[11px]" />
            ) : null}
          </DataTable.Row>
        </DataTable.Header>
        <DataTable.Body>
          {lines.map((line, i) => {
            if (line.kind === 'group') {
              return (
                <DataTable.Row key={i} className="!border-0 hover:!bg-transparent">
                  <DataTable.Cell
                    colSpan={onDeleteLine ? 7 : 6}
                    className="!py-1 bg-panel-hover font-semibold text-ink uppercase tracking-wide text-[10px]"
                  >
                    {line.source === 'MANUAL' && (
                      <span className="normal-case tracking-normal text-signal mr-1.5 font-medium">
                        Manual
                      </span>
                    )}
                    {line.description}
                  </DataTable.Cell>
                </DataTable.Row>
              )
            }
            if (line.kind === 'total') {
              return (
                <DataTable.Row key={i} totals>
                  <DataTable.Cell colSpan={5} className="!py-1.5 text-[12px]">
                    {line.description}
                  </DataTable.Cell>
                  <DataTable.Cell numeric className="text-ink font-bold !py-1.5 text-[12px]">
                    {formatMoney(line.amount, currency)}
                  </DataTable.Cell>
                  {onDeleteLine ? <DataTable.Cell className="!py-1.5" /> : null}
                </DataTable.Row>
              )
            }
            return (
              <DataTable.Row key={i}>
                <DataTable.Cell className="font-mono text-[11px] text-steel !py-1">
                  {line.ref}
                </DataTable.Cell>
                <DataTable.Cell className="!py-1 text-[12px] leading-snug">
                  <div className="flex items-start gap-1">
                    {line.source === 'MANUAL' && (
                      <span className="shrink-0 text-[9px] uppercase tracking-wide text-signal border border-signal/40 px-0.5 leading-4">
                        Manual
                      </span>
                    )}
                    {line.source === 'CATALOGUE' && Number(line.qty) === 0 && (
                      <span
                        className="shrink-0 text-[9px] uppercase tracking-wide text-steel border border-steel-border px-0.5 leading-4"
                        title="Type a quantity in the BOQ table"
                      >
                        No qty
                      </span>
                    )}
                    {onDescriptionChange &&
                    (line.selectedBoqId || line.manualBoqId) ? (
                      <EditableDescription
                        value={line.description}
                        onSave={(description) =>
                          onDescriptionChange(line, description)
                        }
                      />
                    ) : (
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                        {line.description}
                      </span>
                    )}
                  </div>
                </DataTable.Cell>
                <DataTable.Cell
                  numeric
                  className={`!py-1 text-[12px] ${line.isRebar ? 'text-chalk' : ''}`}
                >
                  {onQtyChange && (line.selectedBoqId || line.manualBoqId) ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <EditableQty
                        value={Number(line.qty) || 0}
                        integer={line.unit === 'nos' || line.dec === 0}
                        onSave={(quantity) => onQtyChange(line, quantity)}
                      />
                      {['engine', 'input', 'derived'].includes(
                        line.qtySource || '',
                      ) ? (
                        <span className="text-[9px] uppercase tracking-wide text-steel">
                          {line.qtySource === 'derived'
                            ? 'derived from inputs'
                            : 'from inputs'}
                        </span>
                      ) : null}
                      {onFollowInputs &&
                      line.qtySource === 'typed' &&
                      line.suggestedQty != null ? (
                        <button
                          type="button"
                          className="text-[10px] text-signal underline decoration-dotted underline-offset-2 hover:text-ink"
                          title="Clear typed qty and follow Take off Inputs"
                          onClick={() => onFollowInputs(line)}
                        >
                          Use engine qty
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    fmtQty(line.qty, line)
                  )}
                </DataTable.Cell>
                <DataTable.Cell className="text-steel !py-1 text-[11px]">
                  {line.unit}
                </DataTable.Cell>
                <DataTable.Cell numeric className="text-steel !py-1 text-[12px]">
                  {onRateClick && line.lineKey && line.source === 'CATALOGUE' ? (
                    <button
                      type="button"
                      className="w-full text-right underline decoration-dotted underline-offset-2 hover:text-signal"
                      title="Open rate analysis"
                      onClick={() => onRateClick(line)}
                    >
                      {formatMoney(line.rate, currency)}
                    </button>
                  ) : (
                    formatMoney(line.rate, currency)
                  )}
                </DataTable.Cell>
                <DataTable.Cell numeric className="!py-1 text-[12px]">
                  {formatMoney(line.amount, currency)}
                </DataTable.Cell>
                {onDeleteLine ? (
                  <DataTable.Cell className="!py-1">
                    {line.source === 'MANUAL' && line.selectedBoqId ? (
                      <button
                        type="button"
                        className="text-steel hover:text-danger text-[14px] leading-none px-1"
                        title="Remove manual line"
                        onClick={() => onDeleteLine(line)}
                      >
                        ×
                      </button>
                    ) : null}
                  </DataTable.Cell>
                ) : null}
              </DataTable.Row>
            )
          })}
        </DataTable.Body>
      </DataTable>
    </div>
  )
}

function EditableQty({
  value,
  integer,
  onSave,
}: {
  value: number
  integer?: boolean
  onSave: (value: number) => void
}) {
  return (
    <NumericInput
      aria-label="BOQ quantity"
      title="Type a quantity and press Enter or click away."
      value={value}
      allowEmpty
      emptyValue={0}
      min={0}
      integer={integer}
      rememberFormula={false}
      showError={false}
      className="w-[4.5rem] !py-0.5 !px-1 text-right text-[12px] font-mono border border-transparent bg-transparent hover:border-steel-border focus:border-signal"
      onChange={(next) => {
        const qty = next != null && Number.isFinite(next) && next >= 0 ? next : 0
        if (qty !== value) onSave(qty)
      }}
    />
  )
}

function EditableDescription({
  value,
  onSave,
}: {
  value: string
  onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => setDraft(value), [value])

  function save() {
    const next = draft.trim()
    if (!next) {
      setDraft(value)
      return
    }
    if (next !== value) onSave(next)
  }

  const rows = Math.min(8, Math.max(2, draft.split('\n').length + Math.floor(draft.length / 70)))

  return (
    <textarea
      value={draft}
      maxLength={4000}
      rows={rows}
      aria-label="BOQ description"
      title="Edit description — full text is shown and saved on blur"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setDraft(value)
          event.currentTarget.blur()
        }
      }}
      className="min-w-[16rem] w-full resize-y whitespace-pre-wrap break-words border-b border-transparent bg-transparent px-1 text-[12px] leading-snug text-ink outline-none hover:border-steel-border focus:border-signal"
    />
  )
}
