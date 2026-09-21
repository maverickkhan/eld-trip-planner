/** Minimal CSV helpers for the schedule and log-sheet exports. */

function escapeCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * @param rows array of objects
 * @param columns [{ header, value: (row) => cell }]
 */
export function toCsv(rows, columns) {
  const header = columns.map((column) => escapeCell(column.header)).join(',')
  const body = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(','))
  return [header, ...body].join('\n')
}

export const SCHEDULE_COLUMNS = [
  { header: '#', value: (e, i) => i + 1 },
  { header: 'start', value: (e) => e.start },
  { header: 'end', value: (e) => e.end },
  { header: 'duration_hours', value: (e) => e.duration_hours },
  { header: 'status', value: (e) => e.status },
  { header: 'type', value: (e) => e.type },
  { header: 'label', value: (e) => e.label },
  { header: 'start_miles', value: (e) => e.start_miles },
  { header: 'end_miles', value: (e) => e.end_miles },
  { header: 'leg', value: (e) => e.leg ?? '' },
  { header: 'lat', value: (e) => e.location?.lat ?? '' },
  { header: 'lon', value: (e) => e.location?.lon ?? '' },
]

/**
 * @param events   the rows to export (possibly a filtered subset)
 * @param allEvents the full schedule, so "#" matches the on-screen numbering
 */
export function scheduleToCsv(events, allEvents = events) {
  const indexed = events.map((event) => ({ ...event, __index: Math.max(allEvents.indexOf(event), 0) }))
  return toCsv(
    indexed,
    SCHEDULE_COLUMNS.map((column) => ({ ...column, value: (row) => column.value(row, row.__index) })),
  )
}

export const LOG_COLUMNS = [
  { header: 'date', value: (r) => r.date },
  { header: 'day_number', value: (r) => r.day_number },
  { header: 'start', value: (r) => r.start },
  { header: 'end', value: (r) => r.end },
  { header: 'status', value: (r) => r.status },
  { header: 'type', value: (r) => r.type },
  { header: 'label', value: (r) => r.label },
  { header: 'duration_hours', value: (r) => r.duration_hours },
  { header: 'start_miles', value: (r) => r.start_miles },
  { header: 'end_miles', value: (r) => r.end_miles },
]

export function logsToCsv(dailyLogs) {
  const rows = dailyLogs.flatMap((log) =>
    log.entries.map((entry) => ({ ...entry, date: log.date, day_number: log.day_number })),
  )
  return toCsv(rows, LOG_COLUMNS)
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Some browsers abort the download if the URL is revoked in the same tick.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
