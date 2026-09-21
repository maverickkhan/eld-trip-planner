import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined'
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined'
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import WbTwilightOutlinedIcon from '@mui/icons-material/WbTwilightOutlined'
import SectionCard from '../../components/common/SectionCard.jsx'
import StatusChip from '../../components/common/StatusChip.jsx'
import { DUTY_STATUS_COLORS, DUTY_STATUS_LABELS, EVENT_TYPE_COLORS } from '../../constants/dutyStatus.js'
import { downloadCsv, scheduleToCsv } from '../../utils/csv.js'
import { formatDateTime, formatHours, formatMiles, isoDate, pluralize } from '../../utils/format.js'
import { tokens } from '../../theme.js'
import ScheduleTimeline from './ScheduleTimeline.jsx'
import { countTransitions, eventsOnDay, scheduleDays } from './scheduleUtils.js'

const DURATION_COLORS = {
  drive: EVENT_TYPE_COLORS.drive,
  rest: EVENT_TYPE_COLORS.rest,
  break: EVENT_TYPE_COLORS.break,
  restart: EVENT_TYPE_COLORS.restart,
  fuel: EVENT_TYPE_COLORS.fuel,
}

function StatusCell({ status }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: DUTY_STATUS_COLORS[status], flexShrink: 0 }} />
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {DUTY_STATUS_LABELS[status]}
      </Typography>
    </Box>
  )
}

function odometer(event) {
  return event.distance_miles > 0
    ? `${formatMiles(event.start_miles)} → ${formatMiles(event.end_miles)}`
    : formatMiles(event.start_miles)
}

export default function ScheduleTable({ plan }) {
  const events = plan.schedule.events
  // Calendar days come from the log sheets so day numbers match them exactly,
  // including days on which no event starts (e.g. a 34-hour restart day).
  const days = useMemo(
    () => (plan.daily_logs?.length ? plan.daily_logs.map((log) => log.date) : scheduleDays(events)),
    [plan.daily_logs, events],
  )
  const [view, setView] = useState('table')
  const [day, setDay] = useState('all')

  const visible = day === 'all' ? events : eventsOnDay(events, day)

  const rows = []
  let previousDate = null
  visible.forEach((event) => {
    const date = isoDate(event.start)
    const index = events.indexOf(event)
    if (previousDate && date !== previousDate) {
      rows.push({ kind: 'divider', key: `divider-${date}`, date, dayNumber: days.indexOf(date) + 1 })
    }
    rows.push({ kind: 'event', key: `event-${index}`, event, index })
    previousDate = date
  })
  const exportName = `trip-${plan.id}-schedule${day === 'all' ? '' : `-day-${days.indexOf(day) + 1}`}.csv`

  return (
    <SectionCard
      icon={<FormatListNumberedOutlinedIcon />}
      title="Stop-by-stop schedule"
      subtitle="Sequential FMCSA-compliant timeline with duty-status transitions"
      action={
        <Typography variant="caption" color="text.secondary" className="tnum">
          {pluralize(events.length, 'event')} · {pluralize(days.length, 'calendar day')}
        </Typography>
      }
      contentSx={{ p: 0 }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${tokens.borderSubtle}`,
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, value) => value && setView(value)}
          aria-label="Schedule view"
        >
          <ToggleButton value="table">
            <TableRowsOutlinedIcon sx={{ fontSize: 16, mr: 0.75 }} /> Table
          </ToggleButton>
          <ToggleButton value="timeline">
            <TimelineOutlinedIcon sx={{ fontSize: 16, mr: 0.75 }} /> Visual rail
          </ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            value={day}
            onChange={(event) => setDay(event.target.value)}
            displayEmpty
            inputProps={{ 'aria-label': 'Filter by day' }}
            sx={{ fontWeight: 600 }}
          >
            <MenuItem value="all">Day: All</MenuItem>
            {days.map((date, index) => (
              <MenuItem key={date} value={date}>
                Day {index + 1} — {date}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadOutlinedIcon />}
          onClick={() => downloadCsv(exportName, scheduleToCsv(visible, events))}
        >
          Export CSV
        </Button>
      </Box>

      {view === 'table' ? (
        <TableContainer>
          <Table size="small" aria-label="Stop-by-stop schedule">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Activity</TableCell>
                <TableCell>Odometer</TableCell>
                <TableCell>Leg</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) =>
                row.kind === 'divider' ? (
                  <TableRow key={row.key}>
                    <TableCell colSpan={8} sx={{ bgcolor: tokens.surfaceLow, py: 0.75 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WbTwilightOutlinedIcon fontSize="small" color="primary" />
                        <Typography variant="subtitle2" className="tnum">
                          Day {row.dayNumber} — {row.date}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Midnight crossing
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={row.key}>
                    <TableCell className="tnum">{row.index + 1}</TableCell>
                    <TableCell className="tnum" sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(row.event.start)}
                    </TableCell>
                    <TableCell className="tnum" sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(row.event.end)}
                    </TableCell>
                    <TableCell
                      className="tnum"
                      sx={{ fontWeight: 600, color: DURATION_COLORS[row.event.type] ?? 'text.primary' }}
                    >
                      {formatHours(row.event.duration_hours)}
                    </TableCell>
                    <TableCell>
                      <StatusCell status={row.event.status} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <StatusChip kind="event" value={row.event.type} />
                        <Typography variant="body2">{row.event.label}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell className="tnum" sx={{ whiteSpace: 'nowrap' }}>
                      {odometer(row.event)}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {row.event.leg ? row.event.leg.replaceAll('_', ' ') : '—'}
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box sx={{ p: 2 }}>
          <ScheduleTimeline events={visible} />
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          gap: 3,
          flexWrap: 'wrap',
          px: 2,
          py: 1.25,
          borderTop: `1px solid ${tokens.borderSubtle}`,
          color: 'text.secondary',
        }}
      >
        <Typography variant="caption">
          Total: <strong>{pluralize(events.length, 'event')}</strong>
        </Typography>
        <Typography variant="caption">
          Duty status changes: <strong>{countTransitions(events)}</strong>
        </Typography>
        <Typography variant="caption">
          Legs:{' '}
          <strong>
            {plan.route.legs.map((leg) => `${leg.name.replaceAll('_', ' ')} ${formatMiles(leg.distance_miles)}`).join(' · ')}
          </strong>
        </Typography>
      </Box>
    </SectionCard>
  )
}
