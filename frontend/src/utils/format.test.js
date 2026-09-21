import { describe, expect, it } from 'vitest'
import {
  formatCoord,
  formatHours,
  formatHoursLong,
  formatMinutes,
  formatShortDateTime,
  isoDate,
  isoTime,
  minuteToClock,
  percent,
  pluralize,
} from './format.js'

describe('time formatting', () => {
  it('formats decimal hours as H:MM', () => {
    expect(formatHours(17.54)).toBe('17:32')
    expect(formatHours(0)).toBe('0:00')
    expect(formatHours(10)).toBe('10:00')
  })

  it('formats whole-minute totals', () => {
    expect(formatMinutes(1021)).toBe('17:01')
    expect(formatMinutes(0)).toBe('0:00')
    expect(formatMinutes(1440)).toBe('24:00')
  })

  it('formats long clock values', () => {
    expect(formatHoursLong(8.75)).toBe('08h 45m')
    expect(formatHoursLong(-1)).toBe('00h 00m')
  })

  it('formats minutes since midnight', () => {
    expect(minuteToClock(0)).toBe('00:00')
    expect(minuteToClock(1440)).toBe('24:00')
    expect(minuteToClock(423)).toBe('07:03')
  })

  it('slices naive ISO strings without timezone shifts', () => {
    expect(isoDate('2026-09-21T06:00')).toBe('2026-09-21')
    expect(isoTime('2026-09-21T06:00')).toBe('06:00')
    expect(formatShortDateTime('2026-09-21T04:15:33')).toBe('Sep 21, 04:15')
  })
})

describe('formatCoord', () => {
  it('uses hemisphere letters instead of signs', () => {
    expect(formatCoord({ lat: 41.876, lon: -87.624 })).toBe('41.876° N, 87.624° W')
    expect(formatCoord({ lat: -33.9, lon: 151.2 })).toBe('33.900° S, 151.200° E')
    expect(formatCoord(null)).toBe('')
  })
})

describe('misc', () => {
  it('computes rounded percentages and plurals', () => {
    expect(percent(31.54, 70)).toBe(45)
    expect(percent(1, 0)).toBe(0)
    expect(pluralize(1, 'day')).toBe('1 day')
    expect(pluralize(2, 'day')).toBe('2 days')
  })
})
