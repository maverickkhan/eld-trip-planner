import { useState } from 'react'
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import { downloadCsv, logsToCsv } from '../../utils/csv.js'
import { pluralize } from '../../utils/format.js'
import LogSheet from './LogSheet.jsx'

export default function LogSheetList({ plan }) {
  const logs = plan.daily_logs
  const [selected, setSelected] = useState('all')
  const visible = selected === 'all' ? logs : logs.filter((log) => log.day_number === selected)

  return (
    <Box className="print-root">
      <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Daily log sheets{' '}
          <Typography component="span" variant="body1" color="text.secondary">
            ({pluralize(logs.length, 'day')})
          </Typography>
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={selected}
          onChange={(_, value) => value != null && setSelected(value)}
          sx={{ bgcolor: '#fff', flexWrap: 'wrap' }}
          aria-label="Select log day"
        >
          <ToggleButton value="all">All</ToggleButton>
          {logs.map((log) => (
            <ToggleButton key={log.day_number} value={log.day_number}>
              Day {log.day_number}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" size="small" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
          Print / PDF
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadOutlinedIcon />}
          onClick={() => downloadCsv(`trip-${plan.id}-log-sheets.csv`, logsToCsv(visible))}
        >
          Export CSV
        </Button>
      </Box>

      <Stack spacing={2}>
        {visible.map((log) => (
          <LogSheet key={log.date} log={log} totalDays={logs.length} plan={plan} />
        ))}
      </Stack>
    </Box>
  )
}
