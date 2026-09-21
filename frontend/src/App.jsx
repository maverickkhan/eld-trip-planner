import { Button, Paper, Typography } from '@mui/material'
import { Link as RouterLink, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell.jsx'
import TripPlannerPage from './pages/TripPlannerPage.jsx'

function NotFound() {
  return (
    <Paper sx={{ p: 4, m: 3, maxWidth: 480, mx: 'auto', textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom>
        Page not found.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Back to planner
      </Button>
    </Paper>
  )
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<TripPlannerPage />} />
        <Route path="/trips/:id" element={<TripPlannerPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  )
}
