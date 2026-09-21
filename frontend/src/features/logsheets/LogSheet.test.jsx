import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import plan from '../../test/fixtures/plan.json'
import { describeEntry } from './describeEntry.js'
import LogSheet from './LogSheet.jsx'

describe('LogSheet', () => {
  const log = plan.daily_logs[0]

  it('renders header facts, the four duty rows, totals and one remark per duty change', () => {
    render(<LogSheet log={log} totalDays={plan.daily_logs.length} plan={plan} />)

    expect(screen.getByText(log.date)).toBeInTheDocument()
    expect(screen.getByText(`1 of ${plan.daily_logs.length}`)).toBeInTheDocument()

    const svg = screen.getByRole('img', { name: /24-hour duty status grid/i })
    for (const code of ['1. OFF', '2. SB', '3. D', '4. ON']) {
      expect(svg.textContent).toContain(code)
    }
    expect(svg.querySelector('path').getAttribute('d')).toMatch(/^M /)

    const total = Object.values(log.totals).reduce((sum, hours) => sum + hours, 0)
    expect(Math.abs(total - 24)).toBeLessThan(0.05)

    const remarks = log.entries.filter((entry) => !['pre_trip', 'post_trip'].includes(entry.type))
    expect(screen.getAllByRole('listitem')).toHaveLength(remarks.length)
  })

  it('renders an all-off-duty restart day with 24:00 off duty, one remark and a zero-availability recap', () => {
    const restartDay = {
      date: '2026-09-22',
      day_number: 2,
      miles_driven: 0,
      totals: { off_duty: 24, sleeper_berth: 0, driving: 0, on_duty: 0 },
      entries: [
        {
          status: 'off_duty',
          type: 'restart',
          label: '34-hour cycle restart',
          start: '2026-09-22T00:00',
          end: '2026-09-23T00:00',
          start_minute: 0,
          end_minute: 1440,
          duration_hours: 24,
          start_miles: 497.8,
          end_miles: 497.8,
          location: { lat: 34.328, lon: -110.815 },
        },
      ],
      from: { label: 'En route · mi 497.8', miles: 497.8, location: { lat: 34.328, lon: -110.815 } },
      to: { label: 'En route · mi 497.8', miles: 497.8, location: { lat: 34.328, lon: -110.815 } },
      recap: {
        on_duty_hours_today: 0,
        cycle_used_at_end_of_day: 70,
        hours_available_tomorrow: 0,
        cycle_limit_hours: 70,
        restart_completes_at: '2026-09-23T04:00',
        restart_completed_at: null,
      },
    }
    render(<LogSheet log={restartDay} totalDays={6} plan={plan} />)

    expect(screen.getByText('Off duty all day.')).toBeInTheDocument()
    expect(screen.getAllByText('En route · mi 497.8')).toHaveLength(2)
    expect(screen.getByText(/restart in progress.*2026-09-23 04:00/)).toBeInTheDocument()
    const svg = screen.getByRole('img', { name: /24-hour duty status grid/i })
    expect(svg.textContent).toContain('24:00')
    expect(svg.querySelector('path').getAttribute('d')).toBe(
      `M 118 ${30 + 20} L ${118 + 24 * 32} ${30 + 20}`,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('0 mi')).toBeInTheDocument()
    const recap = screen.getByLabelText('70-hour / 8-day recap')
    expect(recap.textContent).toContain('70:00')
    expect(recap.textContent).toContain('0:00')
  })

  it('omits the recap box for plans saved before recaps existed', () => {
    const { recap: _recap, ...legacy } = plan.daily_logs[0]
    render(<LogSheet log={legacy} totalDays={2} plan={plan} />)
    expect(screen.queryByLabelText('70-hour / 8-day recap')).not.toBeInTheDocument()
  })

  it('describes driving entries with an odometer range and stops with a point', () => {
    expect(
      describeEntry({ type: 'drive', label: 'Driving (to pickup)', start_miles: 0, end_miles: 44.5 }),
    ).toBe('Driving to pickup (0 mi → 44.5 mi)')
    expect(describeEntry({ type: 'pickup', label: 'Pickup (loading)', start_miles: 44.5, end_miles: 44.5 })).toBe(
      'Pickup (loading) @ 44.5 mi',
    )
  })
})
