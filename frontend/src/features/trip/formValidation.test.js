import { describe, expect, it } from 'vitest'
import { validate } from './formValidation.js'

const VALID = {
  current_location: 'Chicago, IL',
  pickup_location: 'Joliet, IL',
  dropoff_location: 'Dallas, TX',
  current_cycle_used_hours: '12',
}

describe('validate', () => {
  it('accepts a complete form with cycle hours inside 0–70', () => {
    expect(validate(VALID)).toEqual({})
    expect(validate({ ...VALID, current_cycle_used_hours: 0 })).toEqual({})
    expect(validate({ ...VALID, current_cycle_used_hours: '70' })).toEqual({})
  })

  it('rejects cycle hours above 70 or below 0 instead of clamping', () => {
    expect(validate({ ...VALID, current_cycle_used_hours: '70.5' }).current_cycle_used_hours).toMatch(/between 0 and 70/)
    expect(validate({ ...VALID, current_cycle_used_hours: '-1' }).current_cycle_used_hours).toMatch(/between 0 and 70/)
  })

  it('rejects blank or non-numeric cycle hours and blank locations', () => {
    expect(validate({ ...VALID, current_cycle_used_hours: '' }).current_cycle_used_hours).toMatch(/0–70/)
    expect(validate({ ...VALID, current_cycle_used_hours: 'abc' }).current_cycle_used_hours).toMatch(/0–70/)
    expect(validate({ ...VALID, pickup_location: '   ' })).toEqual({ pickup_location: 'Required.' })
  })
})
