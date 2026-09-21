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

export function extractMessage(data, response) {
  // A 404 from our own origin with no API base URL means the frontend was
  // deployed without VITE_API_BASE_URL (Vercel answers /api/* with its own 404).
  if (response.status === 404 && !BASE_URL && typeof window !== 'undefined') {
    return `API not reachable at ${window.location.origin}/api (VITE_API_BASE_URL is not set).`
  }
  if (!data || typeof data !== 'object') {
    return `Request failed (${response.status})`
  }
  if (typeof data.detail === 'string') {
    return data.detail
  }
  // Hosting-provider style: { error: { code, message } }
  if (data.error && typeof data.error === 'object') {
    return data.error.message || data.error.code || `Request failed (${response.status})`
  }
  if (typeof data.error === 'string' || typeof data.message === 'string') {
    return data.error || data.message
  }
  // DRF validation errors: { field: ["message", ...] }
  return Object.entries(data)
    .map(([field, messages]) => {
      const text = Array.isArray(messages)
        ? messages.join(' ')
        : typeof messages === 'object' && messages !== null
          ? JSON.stringify(messages)
          : String(messages)
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
