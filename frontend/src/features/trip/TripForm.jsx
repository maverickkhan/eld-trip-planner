import { useState } from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import TimelapseOutlinedIcon from '@mui/icons-material/TimelapseOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import { EXAMPLE_TRIP } from '../../constants/exampleTrip.js'
import { defaultStartTimeValue } from '../../utils/format.js'
import { tokens } from '../../theme.js'
import { describeError } from './errorInfo.js'
import { buildPayload, validate } from './formValidation.js'

function toFormValues(initial) {
  return {
    current_location: initial?.current_location ?? '',
    pickup_location: initial?.pickup_location ?? '',
    dropoff_location: initial?.dropoff_location ?? '',
    current_cycle_used_hours: initial?.current_cycle_used_hours ?? 0,
    start_time: initial?.start_time?.slice(0, 16) ?? defaultStartTimeValue(),
  }
}


const LOCATION_FIELDS = [
  { name: 'current_location', label: 'Current location', hint: 'Origin', Icon: MyLocationOutlinedIcon },
  { name: 'pickup_location', label: 'Pickup location', hint: 'Shipper', Icon: Inventory2OutlinedIcon },
  { name: 'dropoff_location', label: 'Drop-off location', hint: 'Consignee', Icon: FlagOutlinedIcon },
]


function FieldLabel({ htmlFor, label, hint }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
      <Typography component="label" htmlFor={htmlFor} variant="body2" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
    </Box>
  )
}

function startAdornment(Icon) {
  return (
    <InputAdornment position="start">
      <Icon fontSize="small" />
    </InputAdornment>
  )
}

/**
 * The four assessment inputs plus an optional departure time.
 * Controlled; parents pass a `key` to reset it when a different plan loads.
 */
export default function TripForm({
  initialValues,
  onSubmit,
  loading,
  error,
  fieldErrors = {},
  onValuesChange,
  embedded = false,
}) {
  const [values, setValues] = useState(() => toFormValues(initialValues))
  const [localErrors, setLocalErrors] = useState({})
  // API field errors disappear from a field as soon as the user edits it.
  const [edited, setEdited] = useState({ source: fieldErrors, fields: [] })
  const editedFields = edited.source === fieldErrors ? edited.fields : []
  const errorInfo = describeError(error)
  const errors = {
    ...localErrors,
    ...Object.fromEntries(Object.entries(fieldErrors).filter(([field]) => !editedFields.includes(field))),
  }

  function setAll(next) {
    setValues(next)
    onValuesChange?.(next)
  }

  const update = (field) => (event) => {
    setAll({ ...values, [field]: event.target.value })
    if (localErrors[field]) {
      setLocalErrors(({ [field]: _cleared, ...rest }) => rest)
    }
    if (fieldErrors[field] && !editedFields.includes(field)) {
      setEdited({ source: fieldErrors, fields: [...editedFields, field] })
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const problems = validate(values)
    if (Object.keys(problems).length) {
      setLocalErrors(problems)
      return
    }
    setLocalErrors({})
    onSubmit(buildPayload(values))
  }

  const Wrapper = embedded ? Box : Paper

  return (
    <Wrapper component="form" onSubmit={handleSubmit} noValidate aria-label="Trip details">
      {!embedded ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1.5,
            borderBottom: `1px solid ${tokens.borderSubtle}`,
          }}
        >
          <RouteOutlinedIcon color="primary" fontSize="small" />
          <Typography variant="overline" sx={{ flex: 1, fontWeight: 700 }}>
            Trip details
          </Typography>
          <Typography variant="caption" color="text.secondary">
            4 inputs · 1 optional
          </Typography>
        </Box>
      ) : null}

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {LOCATION_FIELDS.map(({ name, label, hint, Icon }) => (
          <Box key={name}>
            <FieldLabel htmlFor={name} label={label} hint={hint} />
            <TextField
              id={name}
              name={name}
              value={values[name]}
              onChange={update(name)}
              placeholder="City, State"
              required
              error={Boolean(errors[name])}
              helperText={errors[name] || undefined}
              slotProps={{ input: { startAdornment: startAdornment(Icon) } }}
            />
          </Box>
        ))}

        <Box>
          <FieldLabel htmlFor="current_cycle_used_hours" label="Current cycle used (hrs, 0–70)" hint="70 hr / 8 day" />
          <TextField
            id="current_cycle_used_hours"
            name="current_cycle_used_hours"
            type="number"
            value={values.current_cycle_used_hours}
            onChange={update('current_cycle_used_hours')}
            required
            error={Boolean(errors.current_cycle_used_hours)}
            helperText={errors.current_cycle_used_hours || 'Hours already on duty in the last 8 days.'}
            slotProps={{
              input: {
                startAdornment: startAdornment(TimelapseOutlinedIcon),
                endAdornment: <InputAdornment position="end">/ 70 h</InputAdornment>,
              },
              htmlInput: { min: 0, max: 70, step: 0.25, inputMode: 'decimal' },
            }}
          />
        </Box>

        <Box>
          <FieldLabel htmlFor="start_time" label="Departure (local time)" hint="Optional" />
          <TextField
            id="start_time"
            name="start_time"
            type="datetime-local"
            value={values.start_time}
            onChange={update('start_time')}
            error={Boolean(errors.start_time)}
            helperText={errors.start_time || 'Defaults to now, rounded up to 15 minutes.'}
            slotProps={{ input: { startAdornment: startAdornment(CalendarMonthOutlinedIcon) } }}
          />
        </Box>

        {error && errorInfo ? (
          <Alert severity={errorInfo.severity} variant="outlined">
            <AlertTitle sx={{ fontSize: 13, fontWeight: 600 }}>{errorInfo.title}</AlertTitle>
            {error.message}
          </Alert>
        ) : null}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowRoundedIcon />}
            sx={{ flex: 1 }}
          >
            {loading ? 'Planning…' : 'Plan trip'}
          </Button>
          <Button type="button" variant="text" disabled={loading} onClick={() => setAll(toFormValues(EXAMPLE_TRIP))}>
            Fill example
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Geocoding + routing use free public services (Nominatim, OSRM); planning takes a few seconds.
        </Typography>
      </Box>
    </Wrapper>
  )
}
