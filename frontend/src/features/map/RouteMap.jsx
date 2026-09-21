import { useEffect, useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import SectionCard from '../../components/common/SectionCard.jsx'
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_REGULATION,
  LEGEND_EVENT_TYPES,
} from '../../constants/dutyStatus.js'
import { formatDateTime, formatHours, formatMiles } from '../../utils/format.js'
import { tokens } from '../../theme.js'

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [28, 28] })
    }
  }, [map, positions])
  return null
}

/** Build one marker per notable point: trip start + every scheduled stop. */
function buildMarkers(plan) {
  const markers = [
    {
      key: 'start',
      type: 'start',
      title: 'Trip start',
      subtitle: plan.locations.current.display_name,
      position: [plan.locations.current.lat, plan.locations.current.lon],
      when: plan.schedule.start_time,
      miles: 0,
    },
  ]
  plan.schedule.stops.forEach((stop, index) => {
    if (!stop.location) return
    markers.push({
      key: `${stop.type}-${index}`,
      type: stop.type,
      title: EVENT_TYPE_LABELS[stop.type] ?? stop.label,
      subtitle: stop.label,
      position: [stop.location.lat, stop.location.lon],
      when: stop.start,
      until: stop.end,
      duration: stop.duration_hours,
      miles: stop.start_miles,
      regulation: EVENT_TYPE_REGULATION[stop.type],
    })
  })
  return markers
}

function Dot({ color, size = 10 }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: color,
        flexShrink: 0,
      }}
    />
  )
}

export default function RouteMap({ plan }) {
  const line = useMemo(
    () => plan.route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    [plan.route.geometry.coordinates],
  )
  const markers = buildMarkers(plan)
  const legs = plan.route.legs

  return (
    <SectionCard
      icon={<ExploreOutlinedIcon />}
      title="Route & stops"
      action={
        <Typography variant="caption" color="text.secondary">
          {legs.map((leg) => `${formatMiles(leg.distance_miles)} ${leg.name.replace('_', ' ')}`).join(' · ')}
        </Typography>
      }
      contentSx={{ p: 0 }}
    >
      <Box sx={{ height: { xs: 340, md: 520 }, borderBottom: `1px solid ${tokens.border}` }}>
        <MapContainer center={line[0]} zoom={5} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Polyline positions={line} pathOptions={{ color: EVENT_TYPE_COLORS.drive, weight: 4, opacity: 0.9 }} />
          {markers.map((marker) => (
            <CircleMarker
              key={marker.key}
              center={marker.position}
              radius={marker.type === 'pickup' || marker.type === 'dropoff' ? 10 : 7}
              pathOptions={{
                color: '#fff',
                weight: 2,
                fillColor: EVENT_TYPE_COLORS[marker.type] ?? '#333',
                fillOpacity: 1,
              }}
            >
              <Popup>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Dot color={EVENT_TYPE_COLORS[marker.type] ?? '#333'} />
                  <Typography variant="subtitle2" sx={{ color: EVENT_TYPE_COLORS[marker.type] ?? 'text.primary', flex: 1 }}>
                    {marker.title}
                  </Typography>
                  {marker.regulation ? (
                    <Typography variant="caption" color="text.secondary">
                      {marker.regulation}
                    </Typography>
                  ) : null}
                </Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {marker.subtitle}
                </Typography>
                <Typography variant="body2" className="tnum" color="text.secondary">
                  {formatDateTime(marker.when)}
                  {marker.until ? ` → ${formatDateTime(marker.until)}` : ''}
                  {marker.duration ? ` (${formatHours(marker.duration)})` : ''}
                </Typography>
                <Typography variant="body2" className="tnum" sx={{ mt: 0.5 }}>
                  Odometer: <strong>{formatMiles(marker.miles)}</strong>
                </Typography>
              </Popup>
            </CircleMarker>
          ))}
          <FitBounds positions={line} />
        </MapContainer>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', px: 2, py: 1.25 }}>
        {LEGEND_EVENT_TYPES.map((type) => (
          <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Dot color={EVENT_TYPE_COLORS[type]} />
            <Typography variant="body2">{EVENT_TYPE_LABELS[type]}</Typography>
          </Box>
        ))}
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Dot color={EVENT_TYPE_COLORS.start} />
          <Typography variant="body2" color="text.secondary">
            Start: {plan.inputs.current_location} (0.0 mi)
          </Typography>
        </Box>
      </Box>

      {/* Stops & rests, in order, right under the map so the map view is self-contained. */}
      <Box
        component="ol"
        aria-label="Stops and rests"
        sx={{
          listStyle: 'none',
          m: 0,
          px: 2,
          pb: 1.5,
          display: 'grid',
          gap: 0.75,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {plan.schedule.stops.map((stop, index) => (
          <Box
            component="li"
            key={`${stop.start}-${index}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.75,
              border: `1px solid ${tokens.border}`,
              borderRadius: 1,
              bgcolor: tokens.surfaceLow,
              minWidth: 0,
            }}
          >
            <Dot color={EVENT_TYPE_COLORS[stop.type] ?? '#333'} size={10} />
            <Typography variant="body2" className="tnum" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {formatDateTime(stop.start).slice(5)}
            </Typography>
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {stop.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" className="tnum" sx={{ whiteSpace: 'nowrap' }}>
              {formatHours(stop.duration_hours)} · {formatMiles(stop.start_miles)}
            </Typography>
          </Box>
        ))}
      </Box>
    </SectionCard>
  )
}
