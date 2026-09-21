// The API returns naive local ISO strings ("2026-09-21T06:00").  Slicing
// avoids Date() timezone surprises.

export function isoDate(iso) {
  return iso ? iso.slice(0, 10) : ''
}

export function isoTime(iso) {
  return iso ? iso.slice(11, 16) : ''
}

export function formatDateTime(iso) {
  return iso ? `${isoDate(iso)} ${isoTime(iso)}` : ''
}

/** 7.53 -> "7:32" */
export function formatHours(hours) {
  const totalMinutes = Math.round((hours || 0) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** 1021 (minutes) -> "17:01" */
export function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(minutes || 0))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** 8.75 -> "08h 45m" */
export function formatHoursLong(hours) {
  const totalMinutes = Math.max(0, Math.round((hours || 0) * 60))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
}

export function formatMiles(miles) {
  return `${Number(miles || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} mi`
}

export function formatNumber(value, digits = 1) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits })
}

/** Minutes since midnight -> "HH:MM" (1440 -> "24:00"). */
export function minuteToClock(minute) {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Value for <input type="datetime-local">: now rounded up to 15 minutes. */
export function defaultStartTimeValue(date = new Date()) {
  const d = new Date(date)
  d.setSeconds(0, 0)
  const remainder = d.getMinutes() % 15
  if (remainder) d.setMinutes(d.getMinutes() + (15 - remainder))
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatLatLon(location) {
  if (!location) return ''
  return `${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}`
}

/** {lat: 41.876, lon: -87.624} -> "41.876° N, 87.624° W" */
export function formatCoord(location) {
  if (!location) return ''
  const lat = `${Math.abs(location.lat).toFixed(3)}° ${location.lat >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(location.lon).toFixed(3)}° ${location.lon >= 0 ? 'E' : 'W'}`
  return `${lat}, ${lon}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-09-21T04:15:33" -> "Sep 21, 04:15" (no Date parsing). */
export function formatShortDateTime(iso) {
  if (!iso || iso.length < 16) return iso || ''
  const month = MONTHS[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7)
  return `${month} ${Number(iso.slice(8, 10))}, ${iso.slice(11, 16)}`
}

export function percent(part, whole) {
  if (!whole) return 0
  return Math.round((part / whole) * 100)
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}
