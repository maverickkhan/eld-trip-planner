import { useCallback, useRef, useState } from 'react'
import { getTrip, planTrip } from '../api/client.js'

const IDLE = { status: 'idle', plan: null, error: null, payload: null }

function toErrorInfo(error) {
  return {
    message: error?.message ?? 'Unknown error',
    status: error?.status ?? 0,
    code: error?.code ?? null,
    details: error?.details ?? null,
  }
}

/**
 * Owns the plan-request lifecycle so pages stay presentational.
 * status: 'idle' | 'loading' | 'success' | 'error'
 * payload: the last submitted form values (enables retry + field-error mapping)
 *
 * Only the most recently started request may update state: a slow response
 * from an earlier submit/load/reset never overwrites a newer one.  While a
 * submit is in flight (or fails) the previously shown plan is retained so the
 * page can keep its form mounted; pages should treat `plan` as displayable
 * only when `status === 'success'`.
 */
export function useTripPlan() {
  const [state, setState] = useState(IDLE)
  const requestId = useRef(0)

  const submit = useCallback(async (payload) => {
    const id = ++requestId.current
    setState((previous) => ({ status: 'loading', plan: previous.plan, error: null, payload }))
    try {
      const plan = await planTrip(payload)
      if (requestId.current !== id) return null
      setState({ status: 'success', plan, error: null, payload })
      return plan
    } catch (error) {
      if (requestId.current !== id) return null
      setState((previous) => ({ status: 'error', plan: previous.plan, error: toErrorInfo(error), payload }))
      return null
    }
  }, [])

  const load = useCallback(async (tripId, preloaded = null) => {
    const id = ++requestId.current
    if (preloaded && String(preloaded.id) === String(tripId)) {
      setState({ status: 'success', plan: preloaded, error: null, payload: null })
      return preloaded
    }
    setState({ status: 'loading', plan: null, error: null, payload: null })
    try {
      const plan = await getTrip(tripId)
      if (requestId.current !== id) return null
      setState({ status: 'success', plan, error: null, payload: null })
      return plan
    } catch (error) {
      if (requestId.current !== id) return null
      setState({ status: 'error', plan: null, error: toErrorInfo(error), payload: null })
      return null
    }
  }, [])

  const retry = useCallback(() => {
    if (state.payload) return submit(state.payload)
    return Promise.resolve(null)
  }, [state.payload, submit])

  const reset = useCallback(() => {
    requestId.current += 1
    setState(IDLE)
  }, [])

  return { ...state, submit, load, retry, reset }
}
