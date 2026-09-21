import { Box, Paper, Typography } from '@mui/material'
import { tokens } from '../../theme.js'

/**
 * Paper card with the design system's header row: icon · title/subtitle · action.
 */
export default function SectionCard({ icon, title, subtitle, action, children, className, sx, contentSx, id }) {
  return (
    <Paper id={id} className={className} sx={sx}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${tokens.borderSubtle}`,
          flexWrap: 'wrap',
        }}
      >
        {icon ? <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>{icon}</Box> : null}
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography variant="subtitle1" component="h2">
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {action ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{action}</Box> : null}
      </Box>
      <Box sx={{ p: 2, ...contentSx }}>{children}</Box>
    </Paper>
  )
}
