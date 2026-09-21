/**
 * Map API errors (see backend trips/exceptions.py) to UI copy and severity.
 */

const HTTP_LABELS = {
  0: 'Network error',
  400: 'HTTP 400 Bad request',
  404: 'HTTP 404 Not found',
  422: 'HTTP 422 Unprocessable',
  500: 'HTTP 500 Server error',
  502: 'HTTP 502 Upstream unavailable',
  503: 'HTTP 503 Service unavailable',
  504: 'HTTP 504 Gateway timeout',
}

export function describeError(error) {
  if (!error) return null
  const { status, code } = error
  const httpLabel = HTTP_LABELS[status] ?? (status ? `HTTP ${status}` : 'Error')

  if (code === 'geocoding_failed') {
    return {
      title: 'Location not found',
      severity: 'error',
      httpLabel: `${httpLabel} · geocoding_failed`,
      tip: 'Try “City, State” or a full street address. Results are limited to the United States.',
      retryable: false,
    }
  }
  if (code === 'routing_failed') {
    return {
      title: 'No driving route',
      severity: 'error',
      httpLabel: `${httpLabel} · routing_failed`,
      tip: 'Check that all three locations are reachable by road in the continental US.',
      retryable: false,
    }
  }
  if (code === 'hos_planning_failed') {
    return {
      title: 'Could not build a legal schedule',
      severity: 'error',
      httpLabel: `${httpLabel} · hos_planning_failed`,
      tip: 'Adjust the cycle hours or locations and try again.',
      retryable: false,
    }
  }
  if (code === 'upstream_unavailable' || status === 502 || status === 503 || status === 504) {
    return {
      title: 'Service unavailable',
      severity: 'warning',
      httpLabel: `${httpLabel} · upstream_unavailable`,
      tip: 'The free OSRM / Nominatim public servers are rate-limited; wait a few seconds and retry.',
      retryable: true,
    }
  }
  if (status === 0 || code === 'network') {
    return {
      title: 'Could not reach the API',
      severity: 'warning',
      httpLabel,
      tip: 'Check that the backend is running and VITE_API_BASE_URL points at it.',
      retryable: true,
    }
  }
  if (status === 404) {
    return {
      title: 'Trip not found',
      severity: 'info',
      httpLabel,
      tip: 'The link may be outdated, or the trip was planned against a database that has since been reset.',
      retryable: false,
    }
  }
  if (status === 400) {
    return {
      title: 'Validation error',
      severity: 'error',
      httpLabel,
      tip: 'Cycle hours must be between 0 and 70; all three locations are required.',
      retryable: false,
    }
  }
  return {
    title: 'Request failed',
    severity: 'error',
    httpLabel,
    tip: null,
    retryable: status >= 500,
  }
}

const LOCATION_FIELDS = ['current_location', 'pickup_location', 'dropoff_location']
const FORM_FIELDS = [...LOCATION_FIELDS, 'current_cycle_used_hours', 'start_time']

/** Return { fieldName: message } for errors that can be pinned to one input. */
export function deriveFieldErrors(error, payload) {
  if (!error) return {}

  if (error.status === 400 && error.details && typeof error.details === 'object') {
    return Object.fromEntries(
      Object.entries(error.details)
        .filter(([field]) => FORM_FIELDS.includes(field))
        .map(([field, messages]) => [field, Array.isArray(messages) ? messages.join(' ') : String(messages)]),
    )
  }

  if (error.code === 'geocoding_failed' && payload) {
    const match = error.message.match(/'([^']+)'/)
    const query = match?.[1]
    const field = LOCATION_FIELDS.find((name) => payload[name] === query)
    if (field) return { [field]: 'Location not found' }
  }

  return {}
}
