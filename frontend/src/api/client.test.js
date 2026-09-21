import { describe, expect, it } from 'vitest'
import { extractMessage } from './client.js'

describe('extractMessage', () => {
  it('uses DRF detail strings verbatim', () => {
    expect(extractMessage({ detail: 'No Trip matches the given query.' }, { status: 404 })).toMatch(
      /VITE_API_BASE_URL|No Trip matches/,
    )
    expect(extractMessage({ detail: "Could not find a location matching 'X'." }, { status: 422 })).toBe(
      "Could not find a location matching 'X'.",
    )
  })

  it('flattens DRF field errors', () => {
    expect(
      extractMessage({ current_cycle_used_hours: ['Ensure this value is less than or equal to 70.0.'] }, { status: 400 }),
    ).toBe('current cycle used hours: Ensure this value is less than or equal to 70.0.')
  })

  it('handles hosting-provider style nested error objects instead of printing [object Object]', () => {
    expect(extractMessage({ error: { code: 'NOT_FOUND', message: 'The page could not be found' } }, { status: 500 })).toBe(
      'The page could not be found',
    )
    expect(extractMessage({ error: { code: 'NOT_FOUND' } }, { status: 500 })).toBe('NOT_FOUND')
    expect(extractMessage({ nested: { a: 1 } }, { status: 500 })).toBe('nested: {"a":1}')
  })

  it('falls back to the status code for empty or non-JSON bodies', () => {
    expect(extractMessage(null, { status: 502 })).toBe('Request failed (502)')
    expect(extractMessage('<html>', { status: 503 })).toBe('Request failed (503)')
  })
})
