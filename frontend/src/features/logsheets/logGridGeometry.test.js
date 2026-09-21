import { describe, expect, it } from 'vitest'
import { GRID, buildDutyPath, hourLabel, xForMinute, yForRow } from './logGridGeometry.js'

const ORDER = ['off_duty', 'sleeper_berth', 'driving', 'on_duty']
const rowIndex = (status) => ORDER.indexOf(status)

describe('xForMinute', () => {
  it('maps midnight and 24:00 to the grid edges', () => {
    expect(xForMinute(0)).toBe(GRID.left)
    expect(xForMinute(1440)).toBe(GRID.left + 24 * GRID.hourWidth)
  })

  it('clamps out-of-range minutes', () => {
    expect(xForMinute(-10)).toBe(xForMinute(0))
    expect(xForMinute(2000)).toBe(xForMinute(1440))
  })
})

describe('buildDutyPath', () => {
  it('draws horizontal runs with a vertical step at each status change', () => {
    const entries = [
      { status: 'off_duty', start_minute: 0, end_minute: 360 },
      { status: 'driving', start_minute: 360, end_minute: 423 },
      { status: 'driving', start_minute: 423, end_minute: 500 },
    ]
    const d = buildDutyPath(entries, rowIndex)

    expect(d.startsWith(`M ${xForMinute(0)} ${yForRow(0)}`)).toBe(true)
    expect(d).toContain(`L ${xForMinute(360)} ${yForRow(0)}`) // end of off-duty run
    expect(d).toContain(`L ${xForMinute(360)} ${yForRow(2)}`) // step down to driving
    // Consecutive same-status entries add no extra vertical step:
    // H(off) + V + H(drive) + H(drive) = 4 line commands.
    expect(d.match(/L /g)).toHaveLength(4)
  })

  it('returns an empty path for no entries', () => {
    expect(buildDutyPath([], rowIndex)).toBe('')
  })
})

describe('hourLabel', () => {
  it('marks midnight and noon and wraps to 12-hour numbers', () => {
    expect(hourLabel(0)).toBe('M')
    expect(hourLabel(12)).toBe('N')
    expect(hourLabel(24)).toBe('M')
    expect(hourLabel(13)).toBe('1')
    expect(hourLabel(11)).toBe('11')
  })
})
