import { Suspense, lazy } from 'react'
import { Box, Chip, Paper, Skeleton, Stack, Tab, Tabs } from '@mui/material'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LogSheetList from '../logsheets/LogSheetList.jsx'
import ScheduleTable from '../schedule/ScheduleTable.jsx'
import PermalinkBar from './PermalinkBar.jsx'
import TripSummary from './TripSummary.jsx'

// Leaflet is the largest dependency; load it only when the Map tab is shown.
const RouteMap = lazy(() => import('../map/RouteMap.jsx'))

/** Everything shown for a planned trip; each block is independently swappable. */
export default function TripResults({ plan, tab, onTabChange }) {
  const logCount = plan.daily_logs.length

  return (
    <Stack spacing={2}>
      <PermalinkBar id={plan.id} />
      {/* Printing the Logs tab yields clean sheets; other tabs print their own content. */}
      <TripSummary plan={plan} hideOnPrint={tab === 'logs'} />

      <Paper className="no-print">
        <Tabs
          value={tab}
          onChange={(_, value) => onTabChange(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label="Trip result views"
        >
          <Tab value="map" icon={<MapOutlinedIcon fontSize="small" />} iconPosition="start" label="Map" />
          <Tab
            value="schedule"
            icon={<TableChartOutlinedIcon fontSize="small" />}
            iconPosition="start"
            label="Schedule"
          />
          <Tab
            value="logs"
            icon={<ReceiptLongOutlinedIcon fontSize="small" />}
            iconPosition="start"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Log sheets
                <Chip label={logCount} size="small" color={tab === 'logs' ? 'primary' : 'default'} />
              </Box>
            }
          />
        </Tabs>
      </Paper>

      {tab === 'map' ? (
        <Suspense fallback={<Skeleton variant="rounded" height={560} />}>
          <RouteMap plan={plan} />
        </Suspense>
      ) : null}
      {tab === 'schedule' ? <ScheduleTable plan={plan} /> : null}
      {tab === 'logs' ? <LogSheetList plan={plan} /> : null}
    </Stack>
  )
}
