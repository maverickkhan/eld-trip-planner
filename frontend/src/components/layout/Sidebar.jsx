import { Accordion, AccordionDetails, AccordionSummary, Box, Tab, Tabs, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TripForm from '../../features/trip/TripForm.jsx'
import RecentTrips from '../../features/trip/RecentTrips.jsx'
import FleetContext from '../../features/trip/FleetContext.jsx'

/**
 * Left column: console header, New trip / Recent trips tabs, driver clocks.
 * On small screens the same content collapses into accordions.
 */
export default function Sidebar({ variant = 'desktop', tab, onTabChange, form, recent, plan, cycleUsedInput }) {
  const { key: formKey, ...formProps } = form
  const count = recent.trips.length

  if (variant === 'mobile') {
    const summary = plan
      ? `${plan.inputs.current_location} → ${plan.inputs.pickup_location} → ${plan.inputs.dropoff_location} · ${plan.inputs.current_cycle_used_hours} hrs used`
      : 'Enter locations and cycle hours to plan'
    return (
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Accordion key={formKey} defaultExpanded={!plan}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2">Trip details</Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {summary}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <TripForm {...formProps} embedded />
          </AccordionDetails>
        </Accordion>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Recent trips ({count})</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1.5 }}>
            <RecentTrips {...recent} />
          </AccordionDetails>
        </Accordion>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        position: 'sticky',
        top: 56,
        maxHeight: 'calc(100vh - 56px)',
        overflowY: 'auto',
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="subtitle1" component="h1">
            Trip Planner Console
          </Typography>
          <Typography variant="overline" color="text.secondary">
            Active profile
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Standard property carrier · 11h drive · 14h window
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, value) => onTabChange(value)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 44 }}
      >
        <Tab value="new" label="New trip" sx={{ minHeight: 44 }} />
        <Tab value="recent" label={`Recent trips (${count})`} sx={{ minHeight: 44 }} />
      </Tabs>

      {/* Both panels stay mounted so typed form values survive a peek at Recent trips. */}
      <Box sx={{ display: tab === 'new' ? 'block' : 'none' }}>
        <TripForm key={formKey} {...formProps} />
      </Box>
      <Box sx={{ display: tab === 'recent' ? 'block' : 'none' }}>
        <RecentTrips {...recent} />
      </Box>

      <FleetContext plan={plan} cycleUsedInput={cycleUsedInput} />
    </Box>
  )
}
