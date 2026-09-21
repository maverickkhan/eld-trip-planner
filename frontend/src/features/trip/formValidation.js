export const CYCLE_LIMIT_HOURS = 70

/** API payload from form values; the optional departure time is omitted when empty. */
export function buildPayload(values) {
  const payload = {
    current_location: values.current_location.trim(),
    pickup_location: values.pickup_location.trim(),
    dropoff_location: values.dropoff_location.trim(),
    current_cycle_used_hours: Number(values.current_cycle_used_hours),
  }
  if (values.start_time && String(values.start_time).trim()) {
    payload.start_time = values.start_time
  }
  return payload
}

export const LOCATION_FIELD_NAMES = ['current_location', 'pickup_location', 'dropoff_location']

/**
 * Client-side validation mirroring the API rules (the API stays the source of
 * truth; this only saves a round trip and gives immediate field feedback).
 * Out-of-range cycle hours are rejected, never clamped.
 */
export function validate(values) {
  const problems = {}
  for (const name of LOCATION_FIELD_NAMES) {
    if (!String(values[name] ?? '').trim()) problems[name] = 'Required.'
  }
  const raw = String(values.current_cycle_used_hours ?? '').trim()
  const cycle = Number(raw)
  if (raw === '' || Number.isNaN(cycle)) {
    problems.current_cycle_used_hours = 'Enter the hours already used (0–70).'
  } else if (cycle < 0 || cycle > CYCLE_LIMIT_HOURS) {
    problems.current_cycle_used_hours = `Must be between 0 and ${CYCLE_LIMIT_HOURS} hours (70-hour / 8-day cycle).`
  }
  return problems
}
