import { Box, ButtonBase, Chip, Paper, Skeleton, Typography } from '@mui/material'
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { formatHours, formatMiles, formatShortDateTime, pluralize } from '../../utils/format.js'
import { tokens } from '../../theme.js'

function Meta({ Icon, children }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
      <Icon sx={{ fontSize: 14 }} />
      <Typography variant="caption" className="tnum">
        {children}
      </Typography>
    </Box>
  )
}

export default function RecentTrips({ trips, error, loading }) {
  if (error) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Recent trips unavailable: {error}
        </Typography>
      </Paper>
    )
  }

  if (loading && trips.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={84} />
        ))}
      </Box>
    )
  }

  if (trips.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <HistoryOutlinedIcon sx={{ color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary">
          No trips planned yet. Your planned trips appear here with a permalink.
        </Typography>
      </Paper>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} component="ul" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {trips.map((trip) => (
        <li key={trip.id}>
          <ButtonBase
            component={RouterLink}
            to={`/trips/${trip.id}`}
            sx={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 1 }}
          >
            <Paper sx={{ p: 1.5, '&:hover': { borderColor: tokens.primary, bgcolor: tokens.primarySubtle } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Chip
                  label={`#${trip.id}`}
                  size="small"
                  sx={{ bgcolor: tokens.primaryFixed, color: tokens.onPrimaryFixed }}
                />
                <Typography variant="caption" color="text.secondary" className="tnum">
                  {formatShortDateTime(trip.created_at)}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {trip.current_location} → {trip.pickup_location} → {trip.dropoff_location}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
                <Meta Icon={StraightenOutlinedIcon}>{formatMiles(trip.total_miles)}</Meta>
                <Meta Icon={CalendarTodayOutlinedIcon}>{pluralize(trip.total_days ?? 0, 'day')}</Meta>
                <Meta Icon={TimerOutlinedIcon}>{formatHours(trip.total_hours)}</Meta>
              </Box>
            </Paper>
          </ButtonBase>
        </li>
      ))}
    </Box>
  )
}
