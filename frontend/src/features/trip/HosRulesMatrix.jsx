import { Box, Chip, Paper, Typography } from '@mui/material'
import { HOS_RULES } from '../../constants/hosRules.js'
import { tokens } from '../../theme.js'

const TONES = {
  primary: { bgcolor: tokens.primary, color: '#fff' },
  violet: { bgcolor: '#7C3AED', color: '#fff' },
  neutral: { bgcolor: tokens.surfaceHigh, color: tokens.textPrimary },
}

export default function HosRulesMatrix({ columns = { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: columns }}>
      {HOS_RULES.map((rule) => (
        <Paper key={rule.title} sx={{ p: 1.5, bgcolor: tokens.surfaceLow }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
            <Typography variant="subtitle2">{rule.title}</Typography>
            <Chip label={rule.ref} size="small" sx={{ ...TONES[rule.tone], flexShrink: 0 }} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {rule.body}
          </Typography>
        </Paper>
      ))}
    </Box>
  )
}
