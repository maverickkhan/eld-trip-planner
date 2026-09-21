import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, useMediaQuery, useTheme } from '@mui/material'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar.jsx'
import { EXAMPLE_TRIP } from '../constants/exampleTrip.js'
import ErrorPanel from '../features/trip/ErrorPanel.jsx'
import PlanningStatus from '../features/trip/PlanningStatus.jsx'
import TripResults from '../features/trip/TripResults.jsx'
import WelcomePanel from '../features/trip/WelcomePanel.jsx'
import { deriveFieldErrors } from '../features/trip/errorInfo.js'
import { useRecentTrips } from '../hooks/useRecentTrips.js'
import { useTripPlan } from '../hooks/useTripPlan.js'
import { tokens } from '../theme.js'

const TABS = ['map', 'schedule', 'logs']

/**
 * Single page: sidebar (form, recent trips, driver clocks) + main panel.
 * `/` shows the welcome panel; `/trips/:id` loads a saved plan (permalink);
 * `?tab=map|schedule|logs` selects the result view.
 */
export default function TripPlannerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))

  const { status, plan, error, payload, submit, load, retry, reset } = useTripPlan()
  const displayPlan = status === 'success' ? plan : null
  const recent = useRecentTrips(displayPlan?.id ?? 'none')
  const [sidebarTab, setSidebarTab] = useState('new')

  const requestedTab = searchParams.get('tab')
  const tab = TABS.includes(requestedTab) ? requestedTab : 'map'
  const setTab = useCallback(
    (next) => setSearchParams(next === 'map' ? {} : { tab: next }, { replace: true }),
    [setSearchParams],
  )

  // Load on route change; also reload when the user re-selects the current
  // trip (new location.key) while an error is showing.
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])
  const loadedIdRef = useRef(null)
  useEffect(() => {
    if (!id) {
      loadedIdRef.current = null
      reset()
      return
    }
    if (loadedIdRef.current !== id || statusRef.current === 'error') {
      loadedIdRef.current = id
      load(id, location.state?.plan ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, location.key])

  function showCreated(created) {
    if (created) {
      navigate(`/trips/${created.id}`, { state: { plan: created } })
    }
  }

  async function handleSubmit(values) {
    showCreated(await submit(values))
  }

  async function handleRetry() {
    showCreated(await retry())
  }

  const fieldErrors = useMemo(() => deriveFieldErrors(error, payload), [error, payload])
  // Only planning errors belong in the form; a failed permalink load is shown in the main panel.
  const formError = status === 'error' && error && payload ? error : null

  // The form remounts only when a different plan is shown (or the route
  // changes with no plan).  Typed values survive loading/error states because
  // the hook retains the previous plan, and a successful plan remounts once.
  const formKey = plan ? `plan-${plan.id}` : `route-${id ?? 'new'}`
  const initialValues = plan?.inputs ?? payload ?? EXAMPLE_TRIP

  // Cycle hours for the "at departure" clocks: what the user typed in the
  // current form instance, else what that instance was seeded with.
  const [typedCycle, setTypedCycle] = useState(null)
  const handleValuesChange = useCallback(
    (values) => setTypedCycle({ key: formKey, value: Number(values.current_cycle_used_hours) || 0 }),
    [formKey],
  )
  const cycleUsedInput =
    typedCycle?.key === formKey ? typedCycle.value : Number(initialValues.current_cycle_used_hours) || 0

  let main
  if (status === 'loading') {
    main = <PlanningStatus mode={payload ? 'plan' : 'load'} tripId={id} />
  } else if (status === 'error') {
    main = (
      <ErrorPanel
        error={error}
        context={payload ? 'plan' : 'load'}
        onRetry={payload ? handleRetry : null}
        onReload={!payload && id ? () => load(id) : null}
        onReset={() => navigate('/')}
      />
    )
  } else if (status === 'success' && plan) {
    main = <TripResults plan={plan} tab={tab} onTabChange={setTab} />
  } else {
    main = <WelcomePanel />
  }

  return (
    <Box
      className="planner-layout"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '360px minmax(0, 1fr)' },
        minHeight: 'calc(100vh - 56px)',
      }}
    >
      <Box
        component="aside"
        className="no-print"
        sx={{
          bgcolor: tokens.surfaceLow,
          borderRight: { md: `1px solid ${tokens.border}` },
          borderBottom: { xs: `1px solid ${tokens.border}`, md: 'none' },
          minWidth: 0,
        }}
      >
        <Sidebar
          variant={isDesktop ? 'desktop' : 'mobile'}
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          form={{
            key: formKey,
            initialValues,
            onSubmit: handleSubmit,
            loading: status === 'loading',
            error: formError,
            fieldErrors,
            onValuesChange: handleValuesChange,
          }}
          recent={recent}
          plan={displayPlan}
          cycleUsedInput={cycleUsedInput}
        />
      </Box>
      <Box component="section" className="planner-main" sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
        <Box sx={{ maxWidth: 1280, mx: 'auto' }}>{main}</Box>
      </Box>
    </Box>
  )
}
