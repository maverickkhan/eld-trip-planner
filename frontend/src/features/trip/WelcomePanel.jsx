import { Box, Chip, Paper, Stack, Typography } from '@mui/material'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import SectionCard from '../../components/common/SectionCard.jsx'
import HosRulesMatrix from './HosRulesMatrix.jsx'
import { tokens } from '../../theme.js'

const FEATURES = [
  {
    index: '01',
    Icon: MapOutlinedIcon,
    title: 'Route map with stops',
    body: 'Geocoded corridor with every planned rest, break and fuel stop placed at its odometer mile.',
    color: tokens.primary,
  },
  {
    index: '02',
    Icon: ViewListOutlinedIcon,
    title: 'Stop-by-stop schedule',
    body: 'Chronological duty itinerary: driving, on duty, off duty and sleeper-berth segments with times and miles.',
    color: '#0EA5E9',
  },
  {
    index: '03',
    Icon: ReceiptLongOutlinedIcon,
    title: 'Daily ELD log sheets',
    body: 'One 24-hour grid per calendar day with the duty-status line, totals and remarks, ready to print.',
    color: '#7C3AED',
  },
]

export default function WelcomePanel() {
  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 3, display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 260 }}>
          <Chip
            label="HOS engine ready"
            size="small"
            sx={{ bgcolor: '#39B8FD', color: '#004666', textTransform: 'uppercase', mb: 1.5 }}
          />
          <Typography variant="h4" component="h2" gutterBottom>
            Plan a trip
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Enter the current, pickup and drop-off locations plus the hours already used in the 70-hour
            cycle. The planner geocodes the stops, routes the trip, and applies FMCSA hours-of-service
            rules to produce a stop-by-stop schedule and daily log sheets.
          </Typography>
        </Box>
        <Box
          sx={{
            width: 132,
            height: 132,
            borderRadius: 1,
            bgcolor: tokens.surfaceLow,
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            color: 'primary.main',
          }}
        >
          <ScheduleOutlinedIcon sx={{ fontSize: 72 }} />
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
        {FEATURES.map(({ index, Icon, title, body, color }) => (
          <Paper key={index} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  bgcolor: tokens.surfaceLow,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon />
              </Box>
              <Typography variant="overline" color="text.secondary">
                {index}
              </Typography>
            </Box>
            <Typography variant="subtitle1" gutterBottom>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {body}
            </Typography>
          </Paper>
        ))}
      </Box>

      <SectionCard
        icon={<GavelOutlinedIcon />}
        title="FMCSA property-carrying HOS rules"
        subtitle="Every stop in the plan is placed so none of these limits is exceeded."
        action={
          <Typography variant="caption" color="text.secondary">
            49 CFR Part 395
          </Typography>
        }
      >
        <HosRulesMatrix />
      </SectionCard>
    </Stack>
  )
}
