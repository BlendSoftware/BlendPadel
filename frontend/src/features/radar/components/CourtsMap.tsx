import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { UserLocation, PadelCourt } from '@/types/radar'
import styles from './CourtsMap.module.css'

// ─── Custom Icons ──────────────────────────────────────────────────────────────

function createUserIcon(): L.DivIcon {
  const html = `
    <div style="
      position: relative;
      width: 24px; height: 24px;
    ">
      <div style="
        position: absolute; inset: 0;
        background: rgba(215,255,45,0.15);
        border-radius: 50%;
        animation: userPing 2s ease-out infinite;
      "></div>
      <div style="
        position: absolute; inset: 4px;
        background: #d7ff2d;
        border-radius: 50%;
        border: 2.5px solid #0a0a0a;
        box-shadow: 0 0 14px rgba(215,255,45,0.8);
      "></div>
    </div>
    <style>
      @keyframes userPing {
        0%   { transform: scale(1);   opacity: 0.6; }
        80%  { transform: scale(2.8); opacity: 0; }
        100% { transform: scale(2.8); opacity: 0; }
      }
    </style>
  `
  return L.divIcon({
    html,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function createCourtIcon(): L.DivIcon {
  const html = `
    <div style="
      width: 10px; height: 10px;
      background: rgba(255,255,255,0.25);
      border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,0.4);
      box-shadow: 0 0 6px rgba(255,255,255,0.1);
    "></div>
  `
  return L.divIcon({
    html,
    className: '',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  })
}

function createActiveCourtIcon(): L.DivIcon {
  const html = `
    <div style="
      width: 14px; height: 14px;
      background: #d7ff2d;
      border-radius: 50%;
      border: 2px solid #0a0a0a;
      box-shadow: 0 0 10px rgba(215,255,45,0.7);
    "></div>
  `
  return L.divIcon({
    html,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

// ─── Drag handler ──────────────────────────────────────────────────────────────

function DragHandler({ onCenterChanged }: { onCenterChanged?: (c: UserLocation) => void }) {
  useMapEvents({
    dragend: (e) => {
      const c = e.target.getCenter()
      onCenterChanged?.({ lat: c.lat, lng: c.lng })
    },
  })
  return null
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CourtsMapProps {
  courts: PadelCourt[]
  userLocation: UserLocation
  loading?: boolean
  onCenterChanged?: (center: UserLocation) => void
}

const DEFAULT_ZOOM = 13
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

// ─── Popup styles injected once ────────────────────────────────────────────────

const POPUP_STYLE = `
  .leaflet-popup-content-wrapper {
    background: rgba(12,12,12,0.95) !important;
    border: 1px solid rgba(215,255,45,0.2) !important;
    border-radius: 12px !important;
    box-shadow: 0 12px 32px rgba(0,0,0,0.6) !important;
    backdrop-filter: blur(20px) !important;
  }
  .leaflet-popup-content {
    margin: 10px 14px !important;
    color: #fff !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    line-height: 1.4 !important;
  }
  .leaflet-popup-tip-container { display: none !important; }
  .leaflet-popup-close-button {
    color: rgba(255,255,255,0.4) !important;
    font-size: 18px !important;
    top: 4px !important;
    right: 8px !important;
  }
`

if (typeof document !== 'undefined') {
  const existing = document.getElementById('leaflet-popup-override')
  if (!existing) {
    const style = document.createElement('style')
    style.id = 'leaflet-popup-override'
    style.textContent = POPUP_STYLE
    document.head.appendChild(style)
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CourtsMap({ courts, userLocation, onCenterChanged }: CourtsMapProps) {
  const center: [number, number] = [userLocation.lat, userLocation.lng]

  const userIcon        = useMemo(() => createUserIcon(), [])
  const courtIcon       = useMemo(() => createCourtIcon(), [])
  const activeCourtIcon = useMemo(() => createActiveCourtIcon(), [])

  return (
    <div className={styles.mapFrame}>
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%', background: '#050505' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url={DARK_TILE_URL}
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />

        <DragHandler onCenterChanged={onCenterChanged} />

        {/* Radar radius ring */}
        <Circle
          center={center}
          radius={20000}
          pathOptions={{
            color: '#d7ff2d',
            fillColor: 'transparent',
            opacity: 0.08,
            weight: 1,
            dashArray: '6 4',
          }}
        />

        {/* Secondary ring (5km) */}
        <Circle
          center={center}
          radius={5000}
          pathOptions={{
            color: '#d7ff2d',
            fillColor: 'rgba(215,255,45,0.015)',
            opacity: 0.05,
            weight: 1,
          }}
        />

        {/* User marker */}
        <Marker position={center} icon={userIcon} />

        {/* Court markers */}
        {courts.map((court, i) => {
          const isActive = i % 4 === 0
          return (
            <Marker
              key={court.id}
              position={[court.lat, court.lng]}
              icon={isActive ? activeCourtIcon : courtIcon}
            >
              <Popup>
                <span style={{ color: '#d7ff2d', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '2px', opacity: 0.7 }}>
                  Cancha
                </span>
                {court.name}
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
