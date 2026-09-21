import { useEffect, useState } from 'react'
import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined'
import { tokens } from '../../theme.js'

const STEPS = ['Geocoding 3 locations', 'Routing via OSRM', 'Applying HOS rules']

function useElapsedSeconds() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 200)
    return () => clearInterval(timer)
  }, [])
  return elapsed
}

function ResultSkeletons() {
  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={76} />
        ))}
      </Box>
      <Paper sx={{ p: 2 }}>
        <Skeleton variant="text" width={220} height={28} />
        <Skeleton variant="rounded" height={380} sx={{ mt: 1 }} />
        <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} variant="text" width={90} />
          ))}
        </Box>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Skeleton variant="text" width={260} height={28} />
        <Skeleton variant="rounded" height={36} sx={{ mt: 1 }} />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} variant="text" height={34} />
        ))}
      </Paper>
    </>
  )
}

/**
 * Shown while the API plans a trip (`mode="plan"`) or while a saved trip is
 * fetched by permalink (`mode="load"`).  The single API request gives no
 * progress events, so the stepper advances on elapsed time as an indication
 * of where the pipeline usually is.
 */
export default function PlanningStatus({ mode = 'plan', tripId }) {
  const elapsed = useElapsedSeconds()
  const activeStep = elapsed < 1.5 ? 0 : elapsed < 3.5 ? 1 : 2

  return (
    <Stack spacing={2} aria-busy="true" aria-live="polite">
      <Paper sx={{ overflow: 'hidden' }}>
        <LinearProgress />
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1,
              bgcolor: tokens.surfaceLow,
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <SyncOutlinedIcon
              sx={{ animation: 'spin 1.6s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="subtitle1">
              {mode === 'load'
                ? `Loading trip #${tripId ?? ''}…`
                : 'Planning trip… geocoding, routing and applying HOS rules.'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mode === 'load'
                ? 'Fetching the saved plan from the API.'
                : 'Nominatim resolves the three places, OSRM builds the route, then the HOS engine schedules breaks, rests and fuel stops.'}
            </Typography>
          </Box>
          <Chip label={`Elapsed ${elapsed.toFixed(1)}s`} size="small" sx={{ bgcolor: tokens.primaryFixed, color: tokens.onPrimaryFixed }} className="tnum" />
        </Box>
        {mode === 'plan' ? (
          <Box sx={{ px: 2, pb: 2 }}>
            <Box sx={{ bgcolor: tokens.surfaceLow, borderRadius: 1, p: 1.5 }}>
              <Stepper activeStep={activeStep} alternativeLabel>
                {STEPS.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Usually 3–6 seconds. Free public routing services are rate-limited (1 geocode/second).
            </Typography>
          </Box>
        ) : null}
      </Paper>
      <ResultSkeletons />
    </Stack>
  )
}
