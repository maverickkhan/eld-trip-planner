/**
 * Thin fetch wrapper around the Django API.
 *
 * VITE_API_BASE_URL is empty in development (Vite proxies /api) and set to
 * the hosted backend URL in production.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, status, details, code = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.code = code
  }
}

function extractMessage(data, response) {
  if (!data || typeof data !== 'object') {
    return `Request failed (${response.status})`
  }
  if (typeof data.detail === 'string') {
    return data.detail
  }
  // DRF validation errors: { field: ["message", ...] }
  return Object.entries(data)
    .map(([field, messages]) => {
      const text = Array.isArray(messages) ? messages.join(' ') : String(messages)
      return `${field.replaceAll('_', ' ')}: ${text}`
    })
    .join(' · ')
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...options,
    })
  } catch (error) {
    throw new ApiError(`Could not reach the API (${error.message})`, 0, null, 'network')
  }

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const code = data && typeof data === 'object' && typeof data.code === 'string' ? data.code : null
    throw new ApiError(extractMessage(data, response), response.status, data, code)
  }
  return data
}

export function planTrip(payload) {
  return request('/api/trips/', { method: 'POST', body: JSON.stringify(payload) })
}

export function getTrip(id) {
  return request(`/api/trips/${id}/`)
}

export function listTrips() {
  return request('/api/trips/')
}
