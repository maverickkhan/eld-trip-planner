import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import plan from '../../test/fixtures/plan.json'
import longPlan from '../../test/fixtures/plan-long.json'
import ScheduleTable from './ScheduleTable.jsx'

describe('ScheduleTable', () => {
  const events = plan.schedule.events
  const startDays = new Set(events.map((event) => event.start.slice(0, 10))).size

  it('renders one row per event plus a divider at each midnight crossing', () => {
    render(<ScheduleTable plan={plan} />)
    const table = screen.getByRole('table')
    const bodyRows = within(table).getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(events.length + (startDays - 1))
    expect(screen.getByText(/^Day 2 —/)).toBeInTheDocument()
    expect(screen.getByText(`${events.length} events`)).toBeInTheDocument()
  })

  it('numbers days like the log sheets, even when a restart day has no events starting on it', () => {
    render(<ScheduleTable plan={longPlan} />)
    // 2026-09-22 is entirely inside the 34-hour restart: no divider for it,
    // and the next day must still be called Day 3 (not Day 2).
    expect(screen.queryByText(/^Day 2 —/)).not.toBeInTheDocument()
    expect(screen.getByText('Day 3 — 2026-09-23')).toBeInTheDocument()
    expect(screen.getByText('Day 6 — 2026-09-26')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${longPlan.daily_logs.length} calendar days`))).toBeInTheDocument()
  })

  it('switches to the visual rail view', () => {
    render(<ScheduleTable plan={plan} />)
    fireEvent.click(screen.getByRole('button', { name: /visual rail/i }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(events.length)
  })
})
