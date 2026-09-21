import { Chip } from '@mui/material'
import {
  DUTY_STATUS_LABELS,
  EVENT_CHIP_PALETTES,
  EVENT_TYPE_LABELS,
  STATUS_CHIP_PALETTES,
} from '../../constants/dutyStatus.js'

const FALLBACK = { bg: '#F3F4F6', fg: '#374151', border: '#E5E7EB' }

/**
 * Rectangular semantic chip.
 * kind="event"  -> value is an event type (drive, fuel, rest, ...)
 * kind="status" -> value is a duty status (driving, off_duty, ...)
 */
export default function StatusChip({ kind = 'event', value, label, size = 'medium', sx }) {
  const palette = (kind === 'status' ? STATUS_CHIP_PALETTES[value] : EVENT_CHIP_PALETTES[value]) ?? FALLBACK
  const text = label ?? (kind === 'status' ? DUTY_STATUS_LABELS[value] : EVENT_TYPE_LABELS[value]) ?? value
  return (
    <Chip
      label={text}
      size={size}
      sx={{ bgcolor: palette.bg, color: palette.fg, border: `1px solid ${palette.border}`, ...sx }}
    />
  )
}
