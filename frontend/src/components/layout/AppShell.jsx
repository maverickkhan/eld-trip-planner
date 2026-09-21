import { useState } from 'react'
import {
  AppBar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined'
import CloseIcon from '@mui/icons-material/Close'
import { Link as RouterLink, useLocation, useMatch } from 'react-router-dom'
import HosRulesMatrix from '../../features/trip/HosRulesMatrix.jsx'

function NavButton({ to, active, children, disabled }) {
  return (
    <Button
      component={to ? RouterLink : 'button'}
      to={to ?? undefined}
      disabled={disabled}
      color="inherit"
      size="small"
      sx={{
        color: '#fff',
        opacity: disabled ? 0.5 : 1,
        bgcolor: active ? 'rgba(255,255,255,0.18)' : 'transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
        px: 1.5,
      }}
    >
      {children}
    </Button>
  )
}

export default function AppShell({ children }) {
  const match = useMatch('/trips/:id')
  const location = useLocation()
  const [rulesOpen, setRulesOpen] = useState(false)

  const tripId = match?.params.id
  const tab = new URLSearchParams(location.search).get('tab') ?? 'map'

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        className="no-print"
        sx={{ bgcolor: 'primary.main', borderBottom: '1px solid', borderColor: 'primary.dark' }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 56, gap: 1.5 }}>
          <LocalShippingOutlinedIcon />
          <Typography
            component={RouterLink}
            to="/"
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'inherit',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            ELD Trip Planner
          </Typography>
          <Divider
            orientation="vertical"
            flexItem
            sx={{ borderColor: 'rgba(255,255,255,0.35)', my: 1.5, display: { xs: 'none', md: 'block' } }}
          />
          <Typography variant="body2" sx={{ opacity: 0.9, display: { xs: 'none', md: 'block' }, whiteSpace: 'nowrap' }}>
            Property-carrying driver · 70 hr / 8 day cycle
          </Typography>
          <Chip
            label="FMCSA Part 395"
            size="small"
            sx={{
              bgcolor: 'rgba(255,255,255,0.16)',
              color: '#fff',
              display: { xs: 'none', lg: 'inline-flex' },
              textTransform: 'uppercase',
            }}
          />
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5 }}>
            <NavButton to={tripId ? `/trips/${tripId}` : '/'} active={tab !== 'logs'}>
              Dispatch
            </NavButton>
            <NavButton to={tripId ? `/trips/${tripId}?tab=logs` : null} disabled={!tripId} active={tab === 'logs'}>
              Log sheets
            </NavButton>
            <Button color="inherit" size="small" onClick={() => setRulesOpen(true)} sx={{ color: '#fff', px: 1.5 }}>
              HOS rules
            </Button>
          </Box>
          <Tooltip title="FMCSA hours-of-service rules applied by the planner">
            <IconButton color="inherit" size="small" onClick={() => setRulesOpen(true)} aria-label="Help">
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
        {children}
      </Box>

      <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
          FMCSA property-carrying HOS rules
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            49 CFR Part 395
          </Typography>
          <IconButton
            aria-label="Close"
            onClick={() => setRulesOpen(false)}
            size="small"
            sx={{ position: 'absolute', right: 12, top: 12 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The planner schedules every stop so the trip never violates these limits. Assumptions
            (fresh driver at departure, single 10-hour sleeper-berth resets, no adverse-conditions
            exception) are documented in the project README.
          </Typography>
          <HosRulesMatrix />
        </DialogContent>
      </Dialog>
    </Box>
  )
}
