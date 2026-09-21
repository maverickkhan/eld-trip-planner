import { Box, Chip, Paper, Typography } from '@mui/material'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import { formatHoursLong } from '../../utils/format.js'
import { tokens } from '../../theme.js'

const CYCLE_LIMIT = 70
const DRIVING_LIMIT = 11
const WINDOW_LIMIT = 14

/**
 * Driver clocks: at departure (fresh driver + entered cycle hours) or, once a
 * plan exists, immediately after the final drop-off.
 */
export default function FleetContext({ plan, cycleUsedInput }) {
  const summary = plan?.schedule?.summary
  const afterTrip = Boolean(summary)

  const drive = afterTrip ? summary.driving_hours_remaining : DRIVING_LIMIT
  const window = afterTrip ? summary.window_hours_remaining : WINDOW_LIMIT
  const cycle = afterTrip
    ? (summary.cycle_hours_remaining ?? Math.max(0, CYCLE_LIMIT - summary.cycle_used_at_end))
    : Math.max(0, CYCLE_LIMIT - (Number(cycleUsedInput) || 0))

  const rows = [
    ['Remaining drive (11h)', drive],
    ['Shift window (14h)', window],
    ['Cycle left (70h / 8d)', cycle],
  ]

  return (
    <Paper>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.25,
          borderBottom: `1px solid ${tokens.borderSubtle}`,
        }}
      >
        <Typography variant="overline" sx={{ fontWeight: 700 }}>
          Driver clocks
        </Typography>
        <Chip
          label={afterTrip ? 'After delivery' : 'At departure'}
          size="small"
          sx={{ bgcolor: tokens.primaryFixed, color: tokens.onPrimaryFixed }}
        />
      </Box>
      <Box sx={{ p: 2 }}>
        <Box sx={{ bgcolor: tokens.surfaceLow, borderRadius: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {rows.map(([label, value]) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" className="tnum" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {value == null ? '—' : formatHoursLong(value)}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5, color: 'text.secondary' }}>
          <ScheduleOutlinedIcon sx={{ fontSize: 14 }} />
          <Typography variant="caption">
            {afterTrip
              ? 'Clocks after the final drop-off; a 10-hour reset restores 11h / 14h.'
              : 'Driver assumed rested at departure. 30-min break auto-scheduled at 8h driving.'}
          </Typography>
        </Box>
      </Box>
    </Paper>
  )
}
