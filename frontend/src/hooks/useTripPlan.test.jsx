import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/client.js', () => ({
  planTrip: vi.fn(),
  getTrip: vi.fn(),
}))

import { getTrip, planTrip } from '../api/client.js'
import { useTripPlan } from './useTripPlan.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useTripPlan request sequencing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignores a slow earlier load when a newer load has been issued', async () => {
    const first = deferred()
    const second = deferred()
    getTrip.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)

    const { result } = renderHook(() => useTripPlan())
    act(() => {
      result.current.load('1')
      result.current.load('2')
    })
    await act(async () => {
      second.resolve({ id: 2, inputs: {} })
    })
    await act(async () => {
      first.resolve({ id: 1, inputs: {} }) // arrives late
    })

    expect(result.current.status).toBe('success')
    expect(result.current.plan.id).toBe(2)
  })

  it('discards a response that arrives after reset()', async () => {
    const pending = deferred()
    getTrip.mockImplementationOnce(() => pending.promise)

    const { result } = renderHook(() => useTripPlan())
    act(() => {
      result.current.load('5')
    })
    act(() => {
      result.current.reset()
    })
    await act(async () => {
      pending.resolve({ id: 5, inputs: {} })
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.plan).toBeNull()
  })

  it('keeps the previous plan while a new submit is in flight or fails', async () => {
    getTrip.mockResolvedValueOnce({ id: 5, inputs: {} })
    const { result } = renderHook(() => useTripPlan())
    await act(async () => {
      await result.current.load('5')
    })

    const pending = deferred()
    planTrip.mockImplementationOnce(() => pending.promise)
    act(() => {
      result.current.submit({ current_location: 'x' })
    })
    expect(result.current.status).toBe('loading')
    expect(result.current.plan.id).toBe(5)

    await act(async () => {
      pending.reject(Object.assign(new Error('down'), { status: 502, code: 'upstream_unavailable' }))
    })
    expect(result.current.status).toBe('error')
    expect(result.current.plan.id).toBe(5)
    expect(result.current.error.code).toBe('upstream_unavailable')
    expect(result.current.payload).toEqual({ current_location: 'x' })
  })

  it('retry re-submits the last payload', async () => {
    planTrip.mockRejectedValueOnce(Object.assign(new Error('down'), { status: 502 }))
    planTrip.mockResolvedValueOnce({ id: 9, inputs: {} })
    const { result } = renderHook(() => useTripPlan())
    await act(async () => {
      await result.current.submit({ current_location: 'a' })
    })
    expect(result.current.status).toBe('error')
    await act(async () => {
      await result.current.retry()
    })
    expect(planTrip).toHaveBeenLastCalledWith({ current_location: 'a' })
    expect(result.current.status).toBe('success')
    expect(result.current.plan.id).toBe(9)
  })
})
