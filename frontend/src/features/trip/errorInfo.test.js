import { describe, expect, it } from 'vitest'
import { deriveFieldErrors, describeError } from './errorInfo.js'

describe('describeError', () => {
  it('maps geocoding failures to a non-retryable error', () => {
    const info = describeError({
      status: 422,
      code: 'geocoding_failed',
      message: "Could not find a location matching 'Nowhereville'.",
    })
    expect(info.title).toBe('Location not found')
    expect(info.severity).toBe('error')
    expect(info.retryable).toBe(false)
    expect(info.httpLabel).toContain('422')
  })

  it('marks upstream outages as retryable warnings', () => {
    const info = describeError({ status: 502, code: 'upstream_unavailable', message: 'down' })
    expect(info.severity).toBe('warning')
    expect(info.retryable).toBe(true)
  })

  it('handles missing trips and network errors', () => {
    expect(describeError({ status: 404, message: 'No Trip matches the given query.' }).title).toBe('Trip not found')
    expect(describeError({ status: 0, code: 'network', message: 'x' }).retryable).toBe(true)
    expect(describeError(null)).toBeNull()
  })
})

describe('deriveFieldErrors', () => {
  it('maps DRF validation errors onto form fields', () => {
    const errors = deriveFieldErrors(
      { status: 400, details: { current_cycle_used_hours: ['Ensure this value is less than or equal to 70.0.'] } },
      null,
    )
    expect(errors).toEqual({ current_cycle_used_hours: 'Ensure this value is less than or equal to 70.0.' })
  })

  it('pins a geocoding failure to the field holding the failed query', () => {
    const errors = deriveFieldErrors(
      { status: 422, code: 'geocoding_failed', message: "Could not find a location matching 'Nowhereville'." },
      { current_location: 'Chicago, IL', pickup_location: 'Nowhereville', dropoff_location: 'Dallas, TX' },
    )
    expect(errors).toEqual({ pickup_location: 'Location not found' })
  })

  it('returns nothing for errors that are not field-specific', () => {
    expect(deriveFieldErrors(null, null)).toEqual({})
    expect(deriveFieldErrors({ status: 502, code: 'upstream_unavailable', message: 'x' }, {})).toEqual({})
  })
})
