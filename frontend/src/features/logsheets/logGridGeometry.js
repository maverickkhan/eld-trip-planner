/**
 * Pure geometry helpers for the 24-hour log grid.  No React here so the
 * path-building logic can be unit tested and reused by any renderer.
 */

export const GRID = {
  left: 118, // row label column
  right: 76, // totals column
  top: 30, // hour labels
  rowHeight: 40,
  hourWidth: 32,
  rows: 4,
}

GRID.width = GRID.left + 24 * GRID.hourWidth + GRID.right
GRID.height = GRID.top + GRID.rows * GRID.rowHeight + 6

export function xForMinute(minute) {
  return GRID.left + (Math.min(Math.max(minute, 0), 1440) / 1440) * 24 * GRID.hourWidth
}

export function rowTop(rowIndex) {
  return GRID.top + rowIndex * GRID.rowHeight
}

export function yForRow(rowIndex) {
  return rowTop(rowIndex) + GRID.rowHeight / 2
}

/**
 * Build the SVG path for a day's duty-status line.
 *
 * Entries are contiguous (each starts where the previous ended), so every
 * status change becomes a vertical connector at the shared boundary and
 * every entry a horizontal run on its status row.
 */
export function buildDutyPath(entries, rowIndexForStatus) {
  let d = ''
  let previousY = null

  for (const entry of entries) {
    const x1 = xForMinute(entry.start_minute)
    const x2 = xForMinute(entry.end_minute)
    const y = yForRow(rowIndexForStatus(entry.status))

    if (previousY === null) {
      d += `M ${x1} ${y}`
    } else if (previousY !== y) {
      d += ` L ${x1} ${y}`
    }
    d += ` L ${x2} ${y}`
    previousY = y
  }
  return d
}

/** Hour labels across the top: M 1 2 … 11 N 1 … 11 M */
export function hourLabel(hour) {
  if (hour === 0 || hour === 24) return 'M'
  if (hour === 12) return 'N'
  return String(hour % 12)
}
