import { useEffect, useState } from 'react'
import { listTrips } from '../api/client.js'

/** Fetches the recent-trips list; refetches whenever `refreshKey` changes. */
export function useRecentTrips(refreshKey) {
  const [state, setState] = useState({ trips: [], error: null, loading: true })

  useEffect(() => {
    let cancelled = false
    listTrips()
      .then((data) => {
        if (!cancelled) setState({ trips: Array.isArray(data) ? data : [], error: null, loading: false })
      })
      .catch((error) => {
        if (!cancelled) setState((previous) => ({ trips: previous.trips, error: error.message, loading: false }))
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return state
}
