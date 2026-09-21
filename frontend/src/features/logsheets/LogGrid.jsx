import {
  DUTY_STATUS_COLORS,
  DUTY_STATUS_GRID_LABELS,
  DUTY_STATUS_ORDER,
  DUTY_STATUS_SHORT,
} from '../../constants/dutyStatus.js'
import { formatHours, formatMinutes } from '../../utils/format.js'
import { tokens } from '../../theme.js'
import { GRID, buildDutyPath, hourLabel, rowTop, xForMinute, yForRow } from './logGridGeometry.js'

const rowIndexForStatus = (status) => DUTY_STATUS_ORDER.indexOf(status)
const HOURS = Array.from({ length: 25 }, (_, i) => i)
const QUARTER_TICKS = Array.from({ length: 96 }, (_, i) => i).filter((tick) => tick % 4 !== 0)
const LINE_COLOR = '#1D4ED8'

/**
 * The 24-hour duty-status grid of a paper/ELD log, drawn as SVG.
 * Presentation only: everything it needs comes from `entries` and `totals`.
 */
export default function LogGrid({ entries, totals, totalsMinutes }) {
  // Prefer the API's exact-minute allocation (always sums to 24:00); fall back
  // to rounding decimal hours for plans saved before it existed.
  const totalText = (status) =>
    totalsMinutes && totalsMinutes[status] != null
      ? formatMinutes(totalsMinutes[status])
      : formatHours(totals?.[status] ?? 0)
  const gridLeft = GRID.left
  const gridRight = xForMinute(1440)
  const gridTop = GRID.top
  const gridBottom = rowTop(GRID.rows)
  const path = buildDutyPath(entries, rowIndexForStatus)

  return (
    <svg
      viewBox={`0 0 ${GRID.width} ${GRID.height}`}
      role="img"
      aria-label="24-hour duty status grid"
      fontFamily="Inter, system-ui, sans-serif"
      fontSize="10"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      <rect x={gridLeft} y={gridTop} width={gridRight - gridLeft} height={gridBottom - gridTop} fill="#fff" />

      {/* lane tint under each duty segment */}
      {entries.map((entry, index) => {
        const row = rowIndexForStatus(entry.status)
        if (row < 0) return null
        const x1 = xForMinute(entry.start_minute)
        const x2 = xForMinute(entry.end_minute)
        return (
          <rect
            key={`tint-${index}`}
            x={x1}
            y={rowTop(row)}
            width={Math.max(x2 - x1, 0)}
            height={GRID.rowHeight}
            fill={DUTY_STATUS_COLORS[entry.status]}
            opacity={0.14}
          />
        )
      })}

      {/* rows: separator, labels, totals, quarter-hour ticks */}
      {DUTY_STATUS_ORDER.map((status, row) => {
        const yTop = rowTop(row)
        const yMid = yForRow(row)
        return (
          <g key={status}>
            <line x1={gridLeft} x2={gridRight} y1={yTop} y2={yTop} stroke={tokens.gridFrame} strokeWidth={0.8} />
            <text x={gridLeft - 10} y={yMid - 2} textAnchor="end" fontWeight="700" fontSize="10.5" fill={tokens.textPrimary}>
              {row + 1}. {DUTY_STATUS_SHORT[status]}
            </text>
            <text x={gridLeft - 10} y={yMid + 10} textAnchor="end" fontSize="8.5" fill={tokens.textSecondary}>
              {DUTY_STATUS_GRID_LABELS[status]}
            </text>
            <text x={gridRight + 8} y={yMid + 4} fontWeight="700" fontSize="10.5" fill={LINE_COLOR}>
              {totalText(status)}
            </text>
            {QUARTER_TICKS.map((tick) => {
              const x = xForMinute(tick * 15)
              const half = tick % 2 === 0
              const height = GRID.rowHeight * (half ? 0.45 : 0.28)
              return (
                <line
                  key={tick}
                  x1={x}
                  x2={x}
                  y1={yTop + GRID.rowHeight - height}
                  y2={yTop + GRID.rowHeight}
                  stroke={tokens.gridLine}
                  strokeWidth={0.6}
                />
              )
            })}
          </g>
        )
      })}

      {/* hour lines + labels */}
      {HOURS.map((hour) => {
        const x = xForMinute(hour * 60)
        const major = hour % 12 === 0
        const label = hourLabel(hour)
        const text = label === 'M' ? 'Midnight' : label === 'N' ? 'Noon' : label
        return (
          <g key={hour}>
            <line
              x1={x}
              x2={x}
              y1={gridTop}
              y2={gridBottom}
              stroke={major ? tokens.gridFrame : tokens.gridLine}
              strokeWidth={major ? 1.2 : 0.7}
            />
            <text
              x={x}
              y={gridTop - 8}
              textAnchor="middle"
              fontSize={major ? 8.5 : 9.5}
              fontWeight={major ? 700 : 500}
              fill={tokens.textPrimary}
            >
              {text}
            </text>
          </g>
        )
      })}
      <text x={GRID.width - 2} y={gridTop - 8} textAnchor="end" fontSize="8.5" fontWeight="700" fill={tokens.textSecondary}>
        TOTAL HRS
      </text>

      {/* frame */}
      <rect
        x={gridLeft}
        y={gridTop}
        width={gridRight - gridLeft}
        height={gridBottom - gridTop}
        fill="none"
        stroke={tokens.gridFrame}
        strokeWidth={1.2}
      />

      {/* duty status line */}
      <path d={path} fill="none" stroke={LINE_COLOR} strokeWidth={2.5} strokeLinejoin="miter" strokeLinecap="butt" />
    </svg>
  )
}
