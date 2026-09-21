import { Box, Paper, Typography } from '@mui/material'
import StatusChip from '../../components/common/StatusChip.jsx'
import { formatCoord, formatDateTime, formatHours, formatMiles, isoTime, minuteToClock } from '../../utils/format.js'
import { tokens } from '../../theme.js'
import { describeEntry } from './describeEntry.js'
import LogGrid from './LogGrid.jsx'

const REMARK_STATUS_LABELS = {
  driving: 'Driving',
  on_duty: 'On duty',
  off_duty: 'Off duty',
  sleeper_berth: 'Sleeper berth',
}

// Fields a paper Driver's Daily Log carries that this planner has no data for.
// They are printed as blank lines, exactly like the unfilled paper form.
const BLANK_FORM_FIELDS = [
  'Name of carrier',
  'Main office address',
  'Home terminal address',
  'Truck / tractor & trailer no.',
  'Shipping document no.',
  "Driver's signature",
]

function HeaderField({ label, value, highlight }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'baseline', minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {label}:
      </Typography>
      <Typography
        variant="body2"
        className="tnum"
        sx={{ fontWeight: 700, color: highlight ? 'primary.main' : 'text.primary', whiteSpace: 'nowrap' }}
      >
        {value}
      </Typography>
    </Box>
  )
}

function BlankField({ label }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="div" noWrap>
        {label}
      </Typography>
      <Box sx={{ height: 20, borderBottom: `1px solid ${tokens.borderStrong}` }} aria-hidden="true" />
    </Box>
  )
}

function RecapRow({ code, label, value, highlight }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main', width: 18 }}>
        {code}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <Typography variant="body2" className="tnum" sx={{ fontWeight: 700, color: highlight ? 'primary.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  )
}

/**
 * One daily log sheet: paper-form header, the 24-hour grid, the remarks
 * (one line per duty-status change) and the 70-hour recap.
 */
export default function LogSheet({ log, totalDays, plan }) {
  const remarks = log.entries.filter((entry) => entry.type !== 'pre_trip' && entry.type !== 'post_trip')
  const offDutyAllDay = (log.totals?.off_duty ?? 0) >= 24 - 1e-6
  const recap = log.recap
  const cycleLimit = recap?.cycle_limit_hours ?? 70

  return (
    <Paper className="log-sheet" component="article" sx={{ overflow: 'hidden' }}>
      <Box sx={{ bgcolor: tokens.surfaceLow, px: 2, py: 1.5, borderBottom: `1px solid ${tokens.border}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
            Driver&apos;s daily log (one calendar day — 24 hours)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Record of duty status · 49 CFR §395.8 · property-carrying · 24-hour period starts at midnight
          </Typography>
        </Box>
        <Box
          className="log-facts"
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, auto)' },
            justifyContent: { lg: 'space-between' },
          }}
        >
          <HeaderField label="Date" value={log.date} />
          <HeaderField label="Day" value={`${log.day_number} of ${totalDays}`} />
          <HeaderField label="Total miles driving today" value={formatMiles(log.miles_driven)} highlight />
          <HeaderField label="From" value={log.from?.label ?? plan.inputs.current_location} />
          <HeaderField label="To" value={log.to?.label ?? plan.inputs.dropoff_location} />
          <HeaderField label="Driver type" value="Property, 70h/8d" />
        </Box>
        <Box
          className="log-blank-fields"
          sx={{
            display: 'grid',
            gap: 2,
            mt: 1.5,
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' },
          }}
        >
          {BLANK_FORM_FIELDS.map((label) => (
            <BlankField key={label} label={label} />
          ))}
        </Box>
      </Box>

      <Box className="log-grid-wrap" sx={{ p: 2 }}>
        <Box className="log-grid-scroll">
          <LogGrid entries={log.entries} totals={log.totals} totalsMinutes={log.totals_minutes} />
        </Box>
      </Box>

      <Box
        className="log-sheet-body"
        sx={{
          px: 2,
          pb: 2,
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: recap ? 'minmax(0, 1fr) 280px' : '1fr' },
          alignItems: 'start',
        }}
      >
        <Box sx={{ bgcolor: tokens.surfaceLow, borderRadius: 1, p: 1.5, minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Remarks &amp; duty change sequence
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Location and odometer at each change of duty status
            </Typography>
          </Box>

          {offDutyAllDay ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: remarks.length ? 1 : 0 }}>
              Off duty all day.
            </Typography>
          ) : null}

          {remarks.length ? (
            <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {remarks.map((entry, index) => (
                <Box
                  component="li"
                  className="log-remark-row"
                  key={`${entry.start}-${index}`}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'auto 1fr', md: 'auto auto auto minmax(0, 1fr) auto' },
                    gap: { xs: 0.75, md: 1.5 },
                    alignItems: 'center',
                    bgcolor: '#fff',
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 1,
                    px: 1.5,
                    py: 0.75,
                  }}
                >
                  <Typography variant="body2" className="tnum" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {index + 1}.
                  </Typography>
                  <Typography variant="body2" className="tnum" sx={{ fontWeight: 700 }}>
                    {minuteToClock(entry.start_minute)} – {minuteToClock(entry.end_minute)}
                  </Typography>
                  <StatusChip
                    kind="status"
                    value={entry.status}
                    label={REMARK_STATUS_LABELS[entry.status]}
                    size="small"
                    sx={{ textTransform: 'uppercase', justifySelf: 'start' }}
                  />
                  <Typography variant="body2">{describeEntry(entry)}</Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    className="tnum"
                    sx={{ textAlign: { md: 'right' }, gridColumn: { xs: '1 / -1', md: 'auto' } }}
                  >
                    {formatCoord(entry.location)}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>

        {recap ? (
          <Box
            className="log-recap"
            sx={{ border: `1px solid ${tokens.border}`, borderRadius: 1, p: 1.5, bgcolor: '#fff' }}
            aria-label="70-hour / 8-day recap"
          >
            <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>
              Recap · {cycleLimit} hr / 8 day
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
              Complete at end of day
            </Typography>
            <RecapRow code="A" label="On duty today (driving + on duty)" value={formatHours(recap.on_duty_hours_today)} />
            <RecapRow code="B" label="On duty last 8 days incl. today" value={formatHours(recap.cycle_used_at_end_of_day)} />
            <RecapRow
              code="C"
              label={`Available tomorrow (${cycleLimit} − B)`}
              value={formatHours(recap.hours_available_tomorrow)}
              highlight
            />
            {recap.restart_completes_at ? (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                34-hour restart in progress; the cycle resets to 0:00 when it completes at{' '}
                {formatDateTime(recap.restart_completes_at)}.
              </Typography>
            ) : null}
            {recap.restart_completed_at ? (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                34-hour restart completed at {isoTime(recap.restart_completed_at)}; B counts on-duty time
                since then.
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </Box>
    </Paper>
  )
}
