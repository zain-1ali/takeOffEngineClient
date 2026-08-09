import { useMemo } from 'react'
import type { AxisGrid } from './gridMath'
import { cumulativePositions, gridRef } from './gridMath'

export type GridSelection = {
  gridX: string
  gridY: string
  gridRef: string
}

type Props = {
  grid: AxisGrid
  mode?: 'preview' | 'point' | 'span'
  selected?: GridSelection | null
  start?: GridSelection | null
  end?: GridSelection | null
  onSelect?: (point: GridSelection) => void
}

const W = 360
const H = 220
const PAD = 26

export function GridPreview({
  grid,
  mode = 'preview',
  selected = null,
  start = null,
  end = null,
  onSelect,
}: Props) {
  const layout = useMemo(() => {
    const xs = cumulativePositions(grid.xAxes)
    const ys = cumulativePositions(grid.yAxes)
    const maxX = Math.max(1, xs[xs.length - 1] || 1)
    const maxY = Math.max(1, ys[ys.length - 1] || 1)
    const sx = (W - 2 * PAD) / maxX
    const sy = (H - 2 * PAD) / maxY
    return { xs, ys, sx, sy }
  }, [grid])

  const interactive = mode !== 'preview' && !!onSelect

  function isActive(xLabel: string, yLabel: string): boolean {
    const ref = gridRef(xLabel, yLabel)
    return (
      selected?.gridRef === ref ||
      start?.gridRef === ref ||
      end?.gridRef === ref
    )
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className="block border border-steel-border bg-bg"
      role={interactive ? 'group' : 'img'}
      aria-label="Axis grid preview"
    >
      {layout.xs.map((x, i) => {
        const px = PAD + x * layout.sx
        return (
          <g key={`x-${grid.xAxes[i].label}`}>
            <line
              x1={px}
              y1={PAD}
              x2={px}
              y2={H - PAD}
              stroke="var(--color-steel-border)"
              strokeWidth={1}
            />
            <circle
              cx={px}
              cy={PAD - 10}
              r={8}
              fill="none"
              stroke="var(--color-chalk)"
              strokeWidth={1}
            />
            <text
              x={px}
              y={PAD - 7}
              fill="var(--color-chalk)"
              fontSize={9}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
            >
              {grid.xAxes[i].label}
            </text>
          </g>
        )
      })}
      {layout.ys.map((y, i) => {
        const py = PAD + y * layout.sy
        return (
          <g key={`y-${grid.yAxes[i].label}`}>
            <line
              x1={PAD}
              y1={py}
              x2={W - PAD}
              y2={py}
              stroke="var(--color-steel-border)"
              strokeWidth={1}
            />
            <circle
              cx={PAD - 12}
              cy={py}
              r={8}
              fill="none"
              stroke="var(--color-chalk)"
              strokeWidth={1}
            />
            <text
              x={PAD - 12}
              y={py + 3}
              fill="var(--color-chalk)"
              fontSize={9}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
            >
              {grid.yAxes[i].label}
            </text>
          </g>
        )
      })}
      {layout.xs.map((x, xi) =>
        layout.ys.map((y, yi) => {
          const xLabel = grid.xAxes[xi].label
          const yLabel = grid.yAxes[yi].label
          const px = PAD + x * layout.sx
          const py = PAD + y * layout.sy
          const active = isActive(xLabel, yLabel)
          const isStart = start?.gridRef === gridRef(xLabel, yLabel)
          const isEnd = end?.gridRef === gridRef(xLabel, yLabel)
          return (
            <circle
              key={`${xLabel}-${yLabel}`}
              cx={px}
              cy={py}
              r={interactive ? 6 : 2.5}
              fill={
                active
                  ? 'var(--color-signal)'
                  : interactive
                    ? 'var(--color-panel-hover)'
                    : 'var(--color-steel)'
              }
              stroke={
                active
                  ? 'var(--color-signal-text)'
                  : interactive
                    ? 'var(--color-steel)'
                    : 'none'
              }
              strokeWidth={active ? 1.5 : 1}
              className={
                interactive
                  ? 'cursor-pointer focus:outline-none focus-visible:stroke-[var(--color-chalk)]'
                  : undefined
              }
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? 'button' : undefined}
              aria-label={`Grid ${xLabel}-${yLabel}`}
              onClick={
                interactive
                  ? () =>
                      onSelect?.({
                        gridX: xLabel,
                        gridY: yLabel,
                        gridRef: gridRef(xLabel, yLabel),
                      })
                  : undefined
              }
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect?.({
                          gridX: xLabel,
                          gridY: yLabel,
                          gridRef: gridRef(xLabel, yLabel),
                        })
                      }
                    }
                  : undefined
              }
            >
              <title>
                {xLabel}-{yLabel}
                {isStart ? ' (start)' : isEnd ? ' (end)' : ''}
              </title>
            </circle>
          )
        }),
      )}
      {start && end && (
        <line
          x1={PAD + (gridPointX(grid, start.gridX, layout) ?? 0)}
          y1={PAD + (gridPointY(grid, start.gridY, layout) ?? 0)}
          x2={PAD + (gridPointX(grid, end.gridX, layout) ?? 0)}
          y2={PAD + (gridPointY(grid, end.gridY, layout) ?? 0)}
          stroke="var(--color-signal)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}
    </svg>
  )
}

function gridPointX(
  grid: AxisGrid,
  label: string,
  layout: { xs: number[]; sx: number },
): number | null {
  const i = grid.xAxes.findIndex((a) => a.label === label)
  if (i < 0) return null
  return layout.xs[i] * layout.sx
}

function gridPointY(
  grid: AxisGrid,
  label: string,
  layout: { ys: number[]; sy: number },
): number | null {
  const i = grid.yAxes.findIndex((a) => a.label === label)
  if (i < 0) return null
  return layout.ys[i] * layout.sy
}
