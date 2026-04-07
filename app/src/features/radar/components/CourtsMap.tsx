import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { UserLocation, PadelCourt } from '@/types/radar'

// ─── Custom icons ────────────────────────────────────────────────────────────

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

function createCourtIcon(): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      <path d="M18 0C8.1 0 0 8.1 0 18c0 12.6 18 26 18 26S36 30.6 36 18C36 8.1 27.9 0 18 0z"
        fill="#22c55e" opacity="0.95"/>
      <circle cx="18" cy="17" r="10" fill="#0f172a"/>
      <text x="18" y="22" text-anchor="middle" font-size="12" fill="#22c55e" font-family="system-ui">🎾</text>
    </svg>
  `
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  })
}

// ─── Map auto-center ─────────────────────────────────────────────────────────

function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true })
  }, [map, center[0], center[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ─── Main component ─────────��────────────────────────────────────────────────

interface CourtsMapProps {
  courts: PadelCourt[]
  userLocation: UserLocation
}

const DEFAULT_ZOOM = 13
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

export function CourtsMap({ courts, userLocation }: CourtsMapProps) {
  const center: [number, number] = [userLocation.lat, userLocation.lng]
  const userIcon = createUserIcon()
  const courtIcon = createCourtIcon()

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url={DARK_TILE_URL}
          attribution={TILE_ATTRIBUTION}
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />

        <MapCenter center={center} />

        {/* User location dot */}
        <Marker position={center} icon={userIcon} aria-label="Tu ubicación" />

        {/* Court markers */}
        {courts.map((court) => (
          <Marker
            key={`court-${court.id}`}
            position={[court.lat, court.lng]}
            icon={courtIcon}
            aria-label={`Cancha: ${court.name}`}
          >
            <Popup>
              <div style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600, minWidth: '120px' }}>
                🎾 {court.name}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Attribution overlay */}
      <div className="absolute bottom-1 right-1 z-[999]">
        <p className="text-[9px] text-text-secondary/40">
          © OpenStreetMap · © CARTO
        </p>
      </div>
    </div>
  )
}
