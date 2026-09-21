import { isoDate } from '../../utils/format.js'

/** Distinct calendar dates touched by the schedule, in order. */
export function scheduleDays(events) {
  const days = []
  for (const event of events) {
    for (const date of [isoDate(event.start), isoDate(event.end)]) {
      if (date && !days.includes(date)) days.push(date)
    }
  }
  return days
}

/** Events that overlap the given calendar date (end exactly at midnight excluded). */
export function eventsOnDay(events, date) {
  return events.filter((event) => {
    const startDate = isoDate(event.start)
    const endDate = isoDate(event.end)
    const endsAtMidnight = event.end.slice(11, 16) === '00:00'
    const effectiveEnd = endsAtMidnight && endDate > startDate ? shiftDate(endDate, -1) : endDate
    return startDate <= date && effectiveEnd >= date
  })
}

function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return shifted.toISOString().slice(0, 10)
}

export function countTransitions(events) {
  return events.filter((event, index) => index > 0 && event.status !== events[index - 1].status).length
}
