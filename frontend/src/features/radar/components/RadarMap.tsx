import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { RadarMatch, UserLocation, PadelCourt } from '@/types/radar'

// ─── Custom SVG marker factory ────────────────────────────────────────────────
// Bypasses the broken-path issue with Leaflet's default PNG icons in Vite/bundlers

function createMatchIcon(slotsLeft: number): L.DivIcon {
  const isUrgent = slotsLeft === 1
  const color = isUrgent ? '#f43f5e' : '#22c55e' // rose-500 or padel-green

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <!-- Pin body -->
      <path d="M20 0C9 0 0 9 0 20c0 14 20 28 20 28S40 34 40 20C40 9 31 0 20 0z"
        fill="${color}" opacity="0.95"/>
      <!-- Inner circle -->
      <circle cx="20" cy="19" r="11" fill="#0f172a"/>
      <!-- Racket icon (simplified) -->
      <text x="20" y="24" text-anchor="middle" font-size="13" fill="${color}" font-family="system-ui">🏓</text>
    </svg>
  `

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -48],
  })
}

function createUserIcon(): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#3b82f6" opacity="0.25"/>
      <circle cx="12" cy="12" r="6" fill="#3b82f6" opacity="0.6"/>
      <circle cx="12" cy="12" r="3" fill="#fff"/>
    </svg>
  `
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

// ─── Court icon ──────────────────────────────────────────────────────────────

function createCourtIcon(): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.2 0 0 7.2 0 16c0 11.2 16 24 16 24S32 27.2 32 16C32 7.2 24.8 0 16 0z"
        fill="#3b82f6" opacity="0.9"/>
      <circle cx="16" cy="15" r="9" fill="#0f172a"/>
      <text x="16" y="20" text-anchor="middle" font-size="12" fill="#3b82f6" font-family="system-ui">🎾</text>
    </svg>
  `
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  })
}

// ─── Overpass API hook: fetch padel courts near a location ───────────────────

function useOverpassCourts(lat: number, lng: number, radiusM: number = 10000): PadelCourt[] {
  const [courts, setCourts] = useState<PadelCourt[]>([])
  const lastFetch = useRef('')

  useEffect(() => {
    // Avoid refetching for the same approximate location (rounded to 2 decimals)
    const key = `${lat.toFixed(2)},${lng.toFixed(2)},${radiusM}`
    if (key === lastFetch.current) return
    lastFetch.current = key

    const query = `[out:json][timeout:10];(node["sport"="padel"](around:${radiusM},${lat},${lng});way["sport"="padel"](around:${radiusM},${lat},${lng}););out center;`

    const controller = new AbortController()
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        const results: PadelCourt[] = (data.elements ?? [])
          .filter((el: any) => (el.lat ?? el.center?.lat) != null)
          .map((el: any) => ({
            id: el.id,
            name: el.tags?.name || 'Cancha de pádel',
            lat: el.lat ?? el.center?.lat,
            lng: el.lon ?? el.center?.lon,
          }))
        setCourts(results)
      })
      .catch(() => {
        // Overpass API failure is non-critical — silently ignore
      })

    return () => controller.abort()
  }, [lat, lng, radiusM])

  return courts
}

// ─── Map auto-center sub-component ───────────────────────────────────────────

interface MapCenterProps {
  center: [number, number]
}

function MapCenter({ center }: MapCenterProps) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true })
  }, [map, center[0], center[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ─── "Buscar aquí" button sub-component ──────────────────────────────────────

interface SearchHereButtonProps {
  onSearch: (loc: UserLocation) => void
}

function SearchHereControl({ onSearch }: SearchHereButtonProps) {
  const map = useMap()

  function handleClick() {
    const center = map.getCenter()
    onSearch({ lat: center.lat, lng: center.lng })
  }

  return (
    <div className="leaflet-top leaflet-center" style={{ pointerEvents: 'none' }}>
      <div className="leaflet-control" style={{ pointerEvents: 'auto', marginTop: '12px' }}>
        <button
          onClick={handleClick}
          className="px-4 py-2 rounded-full bg-bg-card border border-padel-green text-padel-green text-sm font-semibold shadow-lg hover:bg-padel-green hover:text-bg-dark transition-colors duration-150 min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green"
          style={{ display: 'block', whiteSpace: 'nowrap' }}
        >
          Buscar aqui
        </button>
      </div>
    </div>
  )
}

// ─── Main RadarMap component ──────────────────────────────────────────────────

interface RadarMapProps {
  matches: RadarMatch[]
  userLocation: UserLocation
  onMarkerClick: (match: RadarMatch) => void
  onSearchHere: (loc: UserLocation) => void
}

// Mendoza default zoom level
const DEFAULT_ZOOM = 13

// CartoDB dark tiles — free, no API key required
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

export function RadarMap({ matches, userLocation, onMarkerClick, onSearchHere }: RadarMapProps) {
  const center: [number, number] = [userLocation.lat, userLocation.lng]
  const userIcon = createUserIcon()
  const courtIcon = createCourtIcon()

  // Fetch padel courts from OpenStreetMap via Overpass API
  const courts = useOverpassCourts(userLocation.lat, userLocation.lng)

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={false}
        attributionControl={false}
      >
        {/* Dark tile layer */}
        <TileLayer
          url={DARK_TILE_URL}
          attribution={TILE_ATTRIBUTION}
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />

        {/* Auto-center when userLocation changes */}
        <MapCenter center={center} />

        {/* "Buscar aquí" floating button */}
        <SearchHereControl onSearch={onSearchHere} />

        {/* User location dot */}
        <Marker position={center} icon={userIcon} aria-label="Tu ubicación" />

        {/* Padel court markers from OpenStreetMap */}
        {courts.map((court) => (
          <Marker
            key={`court-${court.id}`}
            position={[court.lat, court.lng]}
            icon={courtIcon}
            aria-label={`Cancha: ${court.name}`}
          >
            <Popup>
              <div style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600 }}>
                🎾 {court.name}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Match markers */}
        {matches.map((match) => {
          const slotsLeft = 4 - match.joined_count
          const icon = createMatchIcon(slotsLeft)
          return (
            <Marker
              key={match.id}
              position={[match.lat, match.lng]}
              icon={icon}
              eventHandlers={{ click: () => onMarkerClick(match) }}
              aria-label={`Partido de ${match.captain_name}`}
            />
          )
        })}
      </MapContainer>

      {/* Attribution overlay (custom styled) */}
      <div className="absolute bottom-1 right-1 z-[999]">
        <p className="text-[9px] text-text-secondary/40">
          © OpenStreetMap · © CARTO
        </p>
      </div>
    </div>
  )
}
