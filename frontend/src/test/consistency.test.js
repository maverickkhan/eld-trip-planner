/**
 * Cross-view consistency on a real 6-day plan (Los Angeles → Phoenix → New
 * York, 60 h already used) captured from the live API: the numbers shown in
 * the summary, the schedule, the log sheets and both CSV exports must agree.
 */
import { describe, expect, it } from 'vitest'
import { logsToCsv, scheduleToCsv } from '../utils/csv.js'
import plan from './fixtures/plan-long.json'

function parseCsv(text) {
  const lines = text.split('\n')
  const parseLine = (line) => {
    const cells = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cell += '"'
          i += 1
        } else if (ch === '"') {
          quoted = false
        } else {
          cell += ch
        }
      } else if (ch === '"') {
        quoted = true
      } else if (ch === ',') {
        cells.push(cell)
        cell = ''
      } else {
        cell += ch
      }
    }
    cells.push(cell)
    return cells
  }
  const header = parseLine(lines[0])
  return lines.slice(1).map((line) => Object.fromEntries(parseLine(line).map((value, i) => [header[i], value])))
}

const EXPECTED_STATUS = {
  drive: 'driving',
  pickup: 'on_duty',
  dropoff: 'on_duty',
  fuel: 'on_duty',
  break: 'off_duty',
  rest: 'sleeper_berth',
  restart: 'off_duty',
  pre_trip: 'off_duty',
  post_trip: 'off_duty',
}

describe('cross-view consistency (LA → Phoenix → NYC, 60 h used)', () => {
  const { summary, events } = plan.schedule
  const logs = plan.daily_logs
  const scheduleRows = parseCsv(scheduleToCsv(events))
  const logRows = parseCsv(logsToCsv(logs))

  it('is the multi-day, restart-containing scenario it claims to be', () => {
    expect(logs.length).toBeGreaterThanOrEqual(5)
    expect(summary.restarts).toBe(1)
    expect(summary.fuel_stops).toBe(2)
  })

  it('total distance agrees: summary = Σ schedule deltas = final odometer (schedule, sheets, both CSVs)', () => {
    const fromDeltas = events.reduce((sum, e) => sum + e.distance_miles, 0)
    expect(Math.abs(fromDeltas - summary.total_miles)).toBeLessThan(0.5) // per-row 0.1 rounding
    expect(events.at(-1).end_miles).toBeCloseTo(summary.total_miles, 1)
    expect(logs.at(-1).entries.at(-1).end_miles).toBeCloseTo(summary.total_miles, 1)
    expect(Number(scheduleRows.at(-1).end_miles)).toBeCloseTo(summary.total_miles, 1)
    expect(Number(logRows.at(-1).end_miles)).toBeCloseTo(summary.total_miles, 1)
    const fromSheets = logs.reduce((sum, log) => sum + log.miles_driven, 0)
    expect(Math.abs(fromSheets - summary.total_miles)).toBeLessThan(0.5)
  })

  it('log-day count agrees: summary = rendered sheets = distinct CSV dates', () => {
    const csvDates = new Set(logRows.map((row) => row.date))
    expect(summary.total_days).toBe(logs.length)
    expect(csvDates.size).toBe(logs.length)
    expect([...csvDates].sort()).toEqual(logs.map((log) => log.date))
  })

  it('every CSV day sums to 24 hours across all duty statuses', () => {
    const byDate = new Map()
    for (const row of logRows) {
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + Number(row.duration_hours))
    }
    for (const [date, hours] of byDate) {
      expect(Math.abs(hours - 24), `${date} sums to ${hours}`).toBeLessThan(0.05)
    }
  })

  it('status, type and label columns are internally consistent in both CSVs', () => {
    for (const row of [...logRows, ...scheduleRows]) {
      expect(row.status, `${row.type} row`).toBe(EXPECTED_STATUS[row.type])
      if (row.type === 'restart') expect(row.label).toBe('34-hour cycle restart')
      if (row.type === 'rest') expect(row.label).toMatch(/10-hour rest/)
      if (row.type === 'break') expect(row.label).toBe('30-minute break')
    }
  })

  it('cycle used at end = on-duty hours after the last restart (UI vs CSV)', () => {
    const lastRestart = scheduleRows.map((r) => r.type).lastIndexOf('restart')
    expect(lastRestart).toBeGreaterThan(-1)
    const after = scheduleRows.slice(lastRestart + 1)
    const onDuty = after
      .filter((r) => r.status === 'driving' || r.status === 'on_duty')
      .reduce((sum, r) => sum + Number(r.duration_hours), 0)
    expect(Math.abs(onDuty - summary.cycle_used_at_end)).toBeLessThan(0.05)
    expect(logs.at(-1).recap.cycle_used_at_end_of_day).toBeCloseTo(summary.cycle_used_at_end, 1)
  })

  it('a restart-only day exists and is entirely off duty', () => {
    const offDay = logs.find((log) => log.totals.off_duty === 24)
    expect(offDay).toBeDefined()
    expect(offDay.entries).toHaveLength(1)
    expect(offDay.entries[0].type).toBe('restart')
    expect(offDay.miles_driven).toBe(0)
    expect(offDay.recap.on_duty_hours_today).toBe(0)
  })
})
