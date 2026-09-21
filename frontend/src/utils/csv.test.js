import { describe, expect, it } from 'vitest'
import { logsToCsv, scheduleToCsv, toCsv } from './csv.js'

describe('toCsv', () => {
  it('escapes commas, quotes and newlines', () => {
    const csv = toCsv([{ a: 'x,y', b: 'He said "hi"', c: 'line\nbreak' }], [
      { header: 'a', value: (r) => r.a },
      { header: 'b', value: (r) => r.b },
      { header: 'c', value: (r) => r.c },
    ])
    expect(csv.split('\n')[0]).toBe('a,b,c')
    expect(csv).toContain('"x,y"')
    expect(csv).toContain('"He said ""hi"""')
    expect(csv).toContain('"line\nbreak"')
  })
})

describe('scheduleToCsv', () => {
  const events = [
    {
      start: '2026-09-21T06:00',
      end: '2026-09-21T07:03',
      duration_hours: 1.05,
      status: 'driving',
      type: 'drive',
      label: 'Driving (to pickup)',
      start_miles: 0,
      end_miles: 44.5,
      leg: 'to_pickup',
      location: { lat: 41.9, lon: -87.6 },
    },
    {
      start: '2026-09-21T07:03',
      end: '2026-09-21T08:03',
      duration_hours: 1,
      status: 'on_duty',
      type: 'pickup',
      label: 'Pickup (loading)',
      start_miles: 44.5,
      end_miles: 44.5,
      leg: 'to_pickup',
      location: null,
    },
  ]

  it('numbers rows from 1 and includes coordinates when present', () => {
    const lines = scheduleToCsv(events).split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('#,start,end,duration_hours,status,type,label,start_miles,end_miles,leg,lat,lon')
    expect(lines[1].startsWith('1,2026-09-21T06:00,2026-09-21T07:03,1.05,driving,drive,')).toBe(true)
    expect(lines[1].endsWith(',to_pickup,41.9,-87.6')).toBe(true)
    expect(lines[2].startsWith('2,')).toBe(true)
    expect(lines[2].endsWith(',to_pickup,,')).toBe(true)
  })

  it('keeps the on-screen row numbers when exporting a filtered subset', () => {
    const lines = scheduleToCsv([events[1]], events).split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1].startsWith('2,')).toBe(true)
  })
})

describe('logsToCsv', () => {
  it('flattens entries with their sheet date and day number', () => {
    const entry = {
      start: '2026-09-21T00:00',
      end: '2026-09-21T06:00',
      status: 'off_duty',
      type: 'pre_trip',
      label: 'Off duty (before trip)',
      duration_hours: 6,
      start_miles: 0,
      end_miles: 0,
    }
    const logs = [
      { date: '2026-09-21', day_number: 1, entries: [entry, { ...entry, type: 'drive', status: 'driving' }] },
      { date: '2026-09-22', day_number: 2, entries: [entry] },
    ]
    const lines = logsToCsv(logs).split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[1].startsWith('2026-09-21,1,')).toBe(true)
    expect(lines[3].startsWith('2026-09-22,2,')).toBe(true)
  })
})
