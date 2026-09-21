import { Box, Chip, Typography } from '@mui/material'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import SectionCard from '../../components/common/SectionCard.jsx'
import StatTile from '../../components/common/StatTile.jsx'
import { EVENT_TYPE_COLORS } from '../../constants/dutyStatus.js'
import { formatDateTime, formatHours, formatMiles, formatNumber, percent, pluralize } from '../../utils/format.js'

function buildSummaryTiles(plan) {
  const s = plan.schedule.summary
  const legs = plan.route.legs
  const dutyPeriods = (s.rests ?? 0) + (s.restarts ?? 0) + 1
  const avgSpeed = s.average_speed_mph ?? (s.driving_hours ? s.total_miles / s.driving_hours : 0)

  return [
    { label: 'Total distance', value: formatNumber(s.total_miles), unit: 'mi', sub: legs.map((l) => formatMiles(l.distance_miles)).join(' + ') },
    { label: 'Driving time', value: formatHours(s.driving_hours), sub: `across ${pluralize(dutyPeriods, 'duty period')}` },
    { label: 'Trip duration', value: formatHours(s.total_hours), sub: pluralize(s.total_days, 'calendar day') },
    { label: 'Log days', value: s.total_days, sub: 'one sheet per day', color: 'primary.main' },
    { label: 'Departs', value: formatDateTime(plan.schedule.start_time), sub: plan.inputs.current_location },
    { label: 'Delivered', value: formatDateTime(plan.schedule.end_time), sub: plan.inputs.dropoff_location },
    { label: 'Fuel stops', value: s.fuel_stops, sub: 'every 1,000 mi', color: s.fuel_stops ? EVENT_TYPE_COLORS.fuel : undefined },
    { label: '30-min breaks', value: s.breaks, sub: 'after 8 h driving', color: s.breaks ? EVENT_TYPE_COLORS.break : undefined },
    { label: '10-hr rests', value: s.rests, sub: 'sleeper berth', color: s.rests ? EVENT_TYPE_COLORS.rest : undefined },
    { label: '34-hr restarts', value: s.restarts, sub: 'cycle reset', color: s.restarts ? EVENT_TYPE_COLORS.restart : undefined },
    {
      label: 'Cycle used (start → end)',
      value: `${formatHours(s.cycle_used_at_start)} → ${formatHours(s.cycle_used_at_end)}`,
      sub: `${percent(s.cycle_used_at_end, 70)}% of 70 h`,
      color: 'primary.main',
    },
    { label: 'Average speed', value: formatNumber(avgSpeed), unit: 'mph', sub: 'OSRM, capped at 60 mph' },
  ]
}

export default function TripSummary({ plan }) {
  const { locations } = plan
  const tiles = buildSummaryTiles(plan)

  return (
    <SectionCard
      className="trip-summary"
      icon={<AssignmentOutlinedIcon />}
      title="Trip summary"
      action={
        <Chip
          label="HOS compliant · 70h/8d"
          size="small"
          sx={{ bgcolor: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', textTransform: 'uppercase' }}
        />
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {locations.current.display_name} → {locations.pickup.display_name} → {locations.dropoff.display_name}
      </Typography>
      <Box
        className="summary-tiles"
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' },
        }}
      >
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </Box>
    </SectionCard>
  )
}
