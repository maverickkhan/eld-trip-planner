import { Box, Paper, Typography } from '@mui/material'
import StatusChip from '../../components/common/StatusChip.jsx'
import { EVENT_TYPE_COLORS } from '../../constants/dutyStatus.js'
import { formatDateTime, formatHours, formatMiles, isoDate, isoTime } from '../../utils/format.js'
import { tokens } from '../../theme.js'

/** Vertical "rail" view of the schedule; also the mobile default. */
export default function ScheduleTimeline({ events }) {
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {events.map((event, index) => {
        const color = EVENT_TYPE_COLORS[event.type] ?? '#333'
        const isLast = index === events.length - 1
        return (
          <Box
            component="li"
            key={`${index}-${event.start}-${event.type}`}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '64px 20px minmax(0, 1fr)', sm: '132px 20px minmax(0, 1fr)' },
              gap: 1.5,
              alignItems: 'stretch',
              pb: isLast ? 0 : 1.5,
            }}
          >
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" className="tnum" sx={{ fontWeight: 700 }}>
                {isoTime(event.start)}
              </Typography>
              <Typography variant="caption" color="text.secondary" className="tnum" component="div">
                {isoDate(event.start)}
              </Typography>
            </Box>
            <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: color,
                  border: '2px solid #fff',
                  boxShadow: `0 0 0 2px ${color}`,
                  mt: 1.25,
                  zIndex: 1,
                }}
              />
              {!isLast ? (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 24,
                    bottom: -12,
                    left: 'calc(50% - 1px)',
                    width: 2,
                    bgcolor: tokens.border,
                  }}
                />
              ) : null}
            </Box>
            <Paper sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <StatusChip kind="event" value={event.type} />
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 120 }}>
                  {event.label}
                </Typography>
                <Typography variant="body2" className="tnum" sx={{ fontWeight: 700, color }}>
                  {formatHours(event.duration_hours)}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" className="tnum" component="div" sx={{ mt: 0.5 }}>
                {formatDateTime(event.start)} → {formatDateTime(event.end)} ·{' '}
                {event.distance_miles > 0
                  ? `${formatMiles(event.start_miles)} → ${formatMiles(event.end_miles)}`
                  : `@ ${formatMiles(event.start_miles)}`}
                {event.leg ? ` · ${event.leg.replaceAll('_', ' ')}` : ''}
              </Typography>
            </Paper>
          </Box>
        )
      })}
    </Box>
  )
}
