/**
 * The rules the backend engine enforces (backend/trips/hos/rules.py),
 * summarised for the welcome panel and the HOS rules dialog.
 */
export const HOS_RULES = [
  {
    title: '11-hour driving limit',
    ref: '§ 395.3(a)(3)',
    body: 'May drive a maximum of 11 hours after 10 consecutive hours off duty.',
    tone: 'primary',
  },
  {
    title: '14-hour on-duty window',
    ref: '§ 395.3(a)(2)',
    body: 'No driving beyond the 14th consecutive hour after coming on duty. Off-duty time does not extend the window.',
    tone: 'neutral',
  },
  {
    title: '30-minute break',
    ref: '§ 395.3(a)(3)(ii)',
    body: '30 consecutive minutes of non-driving time are required after 8 cumulative hours of driving.',
    tone: 'primary',
  },
  {
    title: '10-hour off-duty reset',
    ref: '§ 395.3(a)(1)',
    body: '10 consecutive hours off duty or in the sleeper berth before driving again.',
    tone: 'neutral',
  },
  {
    title: '34-hour cycle restart',
    ref: '§ 395.3(c)',
    body: 'The 70-hour / 8-day period restarts after 34 or more consecutive hours off duty.',
    tone: 'violet',
  },
  {
    title: '70-hour / 8-day cycle',
    ref: '§ 395.3(b)(2)',
    body: 'No driving after 70 hours on duty in any 8 consecutive days. On-duty (not driving) time counts.',
    tone: 'primary',
  },
  {
    title: 'Fuel stops',
    ref: 'Operating rule',
    body: 'A 30-minute on-duty fuel stop is inserted at least once every 1,000 miles.',
    tone: 'neutral',
  },
  {
    title: 'Pickup & drop-off',
    ref: 'Operating rule',
    body: '1 hour on duty (not driving) is allotted for loading and 1 hour for unloading.',
    tone: 'neutral',
  },
]
