// Row order matches a paper log: Off Duty, Sleeper Berth, Driving, On Duty.
export const DUTY_STATUS_ORDER = ['off_duty', 'sleeper_berth', 'driving', 'on_duty']

export const DUTY_STATUS_LABELS = {
  off_duty: 'Off Duty',
  sleeper_berth: 'Sleeper Berth',
  driving: 'Driving',
  on_duty: 'On Duty (not driving)',
}

export const DUTY_STATUS_SHORT = {
  off_duty: 'OFF',
  sleeper_berth: 'SB',
  driving: 'D',
  on_duty: 'ON',
}

export const DUTY_STATUS_GRID_LABELS = {
  off_duty: 'Off duty',
  sleeper_berth: 'Sleeper',
  driving: 'Driving',
  on_duty: 'Not driving',
}

// FMCSA duty status / event tokens from the design system. Do not alter.
export const DUTY_STATUS_COLORS = {
  off_duty: '#6B7280',
  sleeper_berth: '#7C3AED',
  driving: '#2563EB',
  on_duty: '#D97706',
}

export const EVENT_TYPE_LABELS = {
  drive: 'Driving',
  pickup: 'Pickup',
  dropoff: 'Drop-off',
  fuel: 'Fuel stop',
  break: '30-min break',
  rest: '10-hr rest',
  restart: '34-hr restart',
  pre_trip: 'Off duty',
  post_trip: 'Off duty',
}

export const EVENT_TYPE_COLORS = {
  start: '#6B7280',
  drive: '#2563EB',
  pickup: '#16A34A',
  dropoff: '#DC2626',
  fuel: '#F59E0B',
  break: '#0EA5E9',
  rest: '#7C3AED',
  restart: '#111827',
  pre_trip: '#9CA3AF',
  post_trip: '#9CA3AF',
}

// Regulation reference shown next to rule-driven stops.
export const EVENT_TYPE_REGULATION = {
  break: '49 CFR §395.3(a)(3)(ii)',
  rest: '49 CFR §395.3(a)(1)',
  restart: '49 CFR §395.3(c)',
  fuel: 'Fuel every 1,000 mi',
  pickup: '1 h on duty',
  dropoff: '1 h on duty',
}

// Rectangular chip palettes (background / text / border).
const BLUE = { bg: '#DBEAFE', fg: '#1E40AF', border: '#BFDBFE' }
const VIOLET = { bg: '#EDE9FE', fg: '#5B21B6', border: '#DDD6FE' }
const SKY = { bg: '#E0F2FE', fg: '#0369A1', border: '#BAE6FD' }
const AMBER = { bg: '#FEF3C7', fg: '#92400E', border: '#FDE68A' }
const GREEN = { bg: '#DCFCE7', fg: '#166534', border: '#BBF7D0' }
const RED = { bg: '#FEE2E2', fg: '#991B1B', border: '#FECACA' }
const SLATE = { bg: '#E5E7EB', fg: '#111827', border: '#D1D5DB' }
const GRAY = { bg: '#F3F4F6', fg: '#374151', border: '#E5E7EB' }

export const STATUS_CHIP_PALETTES = {
  driving: BLUE,
  sleeper_berth: VIOLET,
  off_duty: SKY,
  on_duty: AMBER,
}

export const EVENT_CHIP_PALETTES = {
  drive: BLUE,
  pickup: GREEN,
  dropoff: RED,
  fuel: AMBER,
  break: SKY,
  rest: VIOLET,
  restart: SLATE,
  pre_trip: GRAY,
  post_trip: GRAY,
}

export const LEGEND_EVENT_TYPES = ['pickup', 'dropoff', 'fuel', 'break', 'rest', 'restart']
