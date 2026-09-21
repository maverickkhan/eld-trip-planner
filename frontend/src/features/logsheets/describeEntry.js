import { formatMiles } from '../../utils/format.js'

/** One-line remark text for a log-sheet entry. */
export function describeEntry(entry) {
  if (entry.type === 'drive') {
    // "Driving (to pickup)" -> "Driving to pickup (0 mi → 44.5 mi)"
    const label = entry.label.replace(/\s*\((.*)\)\s*$/, ' $1')
    return `${label} (${formatMiles(entry.start_miles)} → ${formatMiles(entry.end_miles)})`
  }
  return `${entry.label} @ ${formatMiles(entry.start_miles)}`
}
