import { Box, Typography } from '@mui/material'
import { tokens } from '../../theme.js'

export default function StatTile({ label, value, unit, sub, color = 'text.primary', sx }) {
  return (
    <Box
      sx={{
        bgcolor: tokens.surfaceLow,
        border: `1px solid ${tokens.border}`,
        borderRadius: 1,
        p: 1.5,
        minWidth: 0,
        ...sx,
      }}
    >
      <Typography variant="overline" color="text.secondary" component="div" sx={{ lineHeight: '14px' }}>
        {label}
      </Typography>
      <Typography
        variant="h6"
        component="div"
        className="tnum"
        sx={{ color, lineHeight: 1.3, mt: 0.5, overflowWrap: 'anywhere' }}
      >
        {value}
        {unit ? (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
            {unit}
          </Typography>
        ) : null}
      </Typography>
      {sub ? (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
          {sub}
        </Typography>
      ) : null}
    </Box>
  )
}
