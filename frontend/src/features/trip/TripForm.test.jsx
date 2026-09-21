import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { buildPayload } from './formValidation.js'
import TripForm from './TripForm.jsx'

const VALUES = {
  current_location: 'Chicago, IL',
  pickup_location: 'Joliet, IL',
  dropoff_location: 'Dallas, TX',
  current_cycle_used_hours: '12',
  start_time: '2026-09-21T06:00',
}

describe('buildPayload', () => {
  it('includes the departure time when set and omits it when the field is empty', () => {
    expect(buildPayload(VALUES)).toEqual({
      current_location: 'Chicago, IL',
      pickup_location: 'Joliet, IL',
      dropoff_location: 'Dallas, TX',
      current_cycle_used_hours: 12,
      start_time: '2026-09-21T06:00',
    })
    expect(buildPayload({ ...VALUES, start_time: '' })).not.toHaveProperty('start_time')
    expect(buildPayload({ ...VALUES, start_time: '   ' })).not.toHaveProperty('start_time')
  })
})

describe('TripForm', () => {
  it('submits without start_time after the user clears the departure field', () => {
    const onSubmit = vi.fn()
    render(<TripForm initialValues={VALUES} onSubmit={onSubmit} loading={false} error={null} />)
    fireEvent.change(screen.getByLabelText('Departure (local time)'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /plan trip/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('start_time')
  })

  it('blocks submission client-side for cycle hours above 70', () => {
    const onSubmit = vi.fn()
    render(<TripForm initialValues={{ ...VALUES, current_cycle_used_hours: 80 }} onSubmit={onSubmit} loading={false} error={null} />)
    fireEvent.click(screen.getByRole('button', { name: /plan trip/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/between 0 and 70/)).toBeInTheDocument()
  })

  it('clears an API field error as soon as that field is edited', () => {
    const fieldErrors = { pickup_location: 'Location not found' }
    render(
      <TripForm
        initialValues={{ ...VALUES, pickup_location: 'Nowhereville' }}
        onSubmit={vi.fn()}
        loading={false}
        error={{ status: 422, code: 'geocoding_failed', message: "Could not find a location matching 'Nowhereville'." }}
        fieldErrors={fieldErrors}
      />,
    )
    // Helper text under the field (the form-level alert also repeats the title).
    expect(screen.getByText('Location not found', { selector: 'p' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Pickup location'), { target: { value: 'Joliet, IL' } })
    expect(screen.queryByText('Location not found', { selector: 'p' })).not.toBeInTheDocument()
  })
})
