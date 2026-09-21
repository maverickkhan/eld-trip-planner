import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PlanningStatus from './PlanningStatus.jsx'

describe('PlanningStatus', () => {
  it('shows the planning pipeline while a trip is being planned', () => {
    render(<PlanningStatus mode="plan" />)
    expect(screen.getByText(/Planning trip… geocoding, routing and applying HOS rules/)).toBeInTheDocument()
    for (const step of ['Geocoding 3 locations', 'Routing via OSRM', 'Applying HOS rules']) {
      expect(screen.getByText(step)).toBeInTheDocument()
    }
    expect(screen.getByText(/Elapsed/)).toBeInTheDocument()
  })

  it('shows a fetch message when loading a saved trip', () => {
    render(<PlanningStatus mode="load" tripId="42" />)
    expect(screen.getByText('Loading trip #42…')).toBeInTheDocument()
    expect(screen.queryByText('Routing via OSRM')).not.toBeInTheDocument()
  })
})
