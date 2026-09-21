import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import WifiOffOutlinedIcon from '@mui/icons-material/WifiOffOutlined'
import LocationOffOutlinedIcon from '@mui/icons-material/LocationOffOutlined'
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined'
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import HosRulesMatrix from './HosRulesMatrix.jsx'
import SectionCard from '../../components/common/SectionCard.jsx'
import { describeError } from './errorInfo.js'
import { tokens } from '../../theme.js'

const ICONS = {
  geocoding_failed: LocationOffOutlinedIcon,
  routing_failed: LocationOffOutlinedIcon,
  upstream_unavailable: WifiOffOutlinedIcon,
  network: WifiOffOutlinedIcon,
}

const CHIP_TONES = {
  error: { bgcolor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' },
  warning: { bgcolor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' },
  info: { bgcolor: tokens.primaryFixed, color: tokens.onPrimaryFixed, border: `1px solid ${tokens.border}` },
}

export default function ErrorPanel({ error, context = 'plan', onRetry, onReload, onReset }) {
  const info = describeError(error)
  if (!info) return null
  const Icon = error.status === 404 ? SearchOffOutlinedIcon : (ICONS[error.code] ?? ErrorOutlineIcon)
  const isNotFound = error.status === 404
  const isLoadFailure = context === 'load' && !isNotFound
  const details =
    error.status === 400 && error.details && typeof error.details === 'object'
      ? Object.entries(error.details).map(([field, messages]) => ({
          field,
          text: Array.isArray(messages) ? messages.join(' ') : String(messages),
        }))
      : null

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1,
              bgcolor: info.severity === 'warning' ? '#FEF3C7' : info.severity === 'info' ? tokens.surfaceLow : '#FEE2E2',
              color: info.severity === 'warning' ? '#92400E' : info.severity === 'info' ? tokens.primary : '#991B1B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon />
          </Box>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              {info.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isNotFound
                ? 'The trip you followed a link to could not be loaded.'
                : isLoadFailure
                  ? 'The saved trip could not be loaded from the API.'
                  : 'The plan could not be produced from the current inputs.'}
            </Typography>
          </Box>
          <Chip label={info.httpLabel} size="small" sx={{ ...CHIP_TONES[info.severity], textTransform: 'uppercase' }} />
        </Box>

        <Alert severity={info.severity} variant="outlined" sx={{ mt: 2 }}>
          {error.message}
        </Alert>

        {details && details.length > 1 ? (
          <Box component="ul" sx={{ m: 0, mt: 1.5, pl: 2.5 }}>
            {details.map(({ field, text }) => (
              <Typography key={field} component="li" variant="body2">
                <strong>{field.replaceAll('_', ' ')}:</strong> {text}
              </Typography>
            ))}
          </Box>
        ) : null}

        {info.tip ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 2, color: 'text.secondary' }}>
            <LightbulbOutlinedIcon sx={{ fontSize: 18, mt: 0.1 }} />
            <Typography variant="body2">{info.tip}</Typography>
          </Box>
        ) : null}

        <Box sx={{ display: 'flex', gap: 1, mt: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          {info.retryable && onRetry ? (
            <Button variant="contained" startIcon={<ReplayOutlinedIcon />} onClick={onRetry}>
              Retry
            </Button>
          ) : null}
          {isLoadFailure && onReload ? (
            <Button variant="contained" startIcon={<ReplayOutlinedIcon />} onClick={onReload}>
              Reload trip
            </Button>
          ) : null}
          {isNotFound || isLoadFailure ? (
            <Button variant={isLoadFailure ? 'outlined' : 'contained'} onClick={onReset}>
              Plan a new trip
            </Button>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Edit the inputs on the left and plan again.
            </Typography>
          )}
        </Box>
      </Paper>

      {error.status === 400 || error.code === 'hos_planning_failed' ? (
        <SectionCard title="Limits the planner enforces" subtitle="49 CFR Part 395, property-carrying drivers">
          <HosRulesMatrix />
        </SectionCard>
      ) : null}
    </Stack>
  )
}
