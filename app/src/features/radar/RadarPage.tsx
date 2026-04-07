import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, List, Map } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

import { Header } from '@/components/layout/Header'
import { Spinner } from '@/components/ui/Spinner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

import { CourtsMap } from './components/CourtsMap'

import { useRadarStore } from '@/stores/radar-store'
import type { UserLocation, PadelCourt } from '@/types/radar'

// Mendoza default
const MENDOZA: UserLocation = { lat: -33.35, lng: -68.33 }

export function RadarPage() {
  const navigate = useNavigate()

  const userLocation = useRadarStore((s) => s.userLocation)
  const locationDenied = useRadarStore((s) => s.locationDenied)
  const setUserLocation = useRadarStore((s) => s.setUserLocation)
  const setLocationDenied = useRadarStore((s) => s.setLocationDenied)

  const [geoInitialized, setGeoInitialized] = useState(false)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [courts, setCourts] = useState<PadelCourt[]>([])
  const [courtsLoading, setCourtsLoading] = useState(false)

  // ── Geolocation on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (geoInitialized) return
    setGeoInitialized(true)

    if (!navigator.geolocation) {
      if (!userLocation) setUserLocation(MENDOZA)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationDenied(false)
      },
      () => {
        if (!userLocation) setLocationDenied(true)
      },
      { timeout: 8000, maximumAge: 60_000 },
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Stable primitives
  const lat = userLocation?.lat
  const lng = userLocation?.lng

  // ── Fetch courts from Overpass API (cached 30 min in localStorage) ──────
  useEffect(() => {
    if (lat == null || lng == null) return

    // Check cache — reuse if same area and < 30 min old
    const cacheKey = `blend-courts-${lat.toFixed(1)},${lng.toFixed(1)}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 30 * 60 * 1000) {
          setCourts(data)
          setCourtsLoading(false)
          return
        }
      }
    } catch { /* ignore corrupt cache */ }

    setCourtsLoading(true)

    const radius = 20000
    const query = `[out:json][timeout:15];(node["sport"="padel"](around:${radius},${lat},${lng});way["sport"="padel"](around:${radius},${lat},${lng});node["sport"="paddle"](around:${radius},${lat},${lng});way["sport"="paddle"](around:${radius},${lat},${lng});node["leisure"="pitch"]["sport"~"padel|paddle"](around:${radius},${lat},${lng});way["leisure"="pitch"]["sport"~"padel|paddle"](around:${radius},${lat},${lng}););out center;`

    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Overpass HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        const seen = new Set<number>()
        const results: PadelCourt[] = (data.elements ?? [])
          .filter((el: any) => {
            if ((el.lat ?? el.center?.lat) == null) return false
            if (seen.has(el.id)) return false
            seen.add(el.id)
            return true
          })
          .map((el: any) => ({
            id: el.id,
            name: el.tags?.name || 'Cancha de pádel',
            lat: el.lat ?? el.center?.lat,
            lng: el.lon ?? el.center?.lon,
          }))
        setCourts(results)
        setCourtsLoading(false)
        // Cache for 30 min
        try { localStorage.setItem(cacheKey, JSON.stringify({ data: results, ts: Date.now() })) } catch {}
      })
      .catch((err) => {
        console.warn('Overpass API error:', err)
        setCourtsLoading(false)
      })
  }, [lat, lng])

  // ── Handlers ───────────��──────────────────────────────────────────────────
  function handleUseMendoza() {
    setUserLocation(MENDOZA)
    setLocationDenied(false)
  }

  // ── Render: location denied ──────────���────────────────────────────────────
  if (locationDenied && !userLocation) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Canchas" />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4">
            <MapPin size={48} className="mx-auto text-text-secondary" />
            <p className="text-text-secondary text-sm">
              Necesitamos tu ubicación para mostrar canchas cercanas
            </p>
            <Button onClick={handleUseMendoza}>
              Usar ubicación de Mendoza
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: waiting for location ──────────────────────────────────────────
  if (!userLocation) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Canchas" />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-text-secondary text-sm">Obteniendo ubicación...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full page-enter">
      <Header
        title="Canchas"
        right={
          <button
            onClick={() => setView(view === 'map' ? 'list' : 'map')}
            className="flex items-center justify-center min-h-11 min-w-11 text-text-secondary hover:text-padel-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg"
            aria-label={view === 'map' ? 'Ver lista' : 'Ver mapa'}
          >
            {view === 'map' ? <List size={20} aria-hidden="true" /> : <Map size={20} aria-hidden="true" />}
          </button>
        }
      />

      {/* Courts count */}
      <div className="px-4 py-2">
        <p className="text-xs text-text-secondary">
          {courtsLoading
            ? 'Buscando canchas cercanas...'
            : `${courts.length} canchas en 20 km`}
        </p>
      </div>

      {view === 'map' ? (
        /* Map view — fills remaining space */
        <div className="flex-1 mx-3 mb-3 relative" style={{ minHeight: '400px' }}>
          {courtsLoading && courts.length === 0 && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-bg-dark/60 rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <Spinner size="lg" />
                <p className="text-text-secondary text-sm">Buscando canchas...</p>
              </div>
            </div>
          )}

          <CourtsMap
            courts={courts}
            userLocation={userLocation}
          />

          {!courtsLoading && courts.length === 0 && (
            <div className="absolute inset-0 z-[999] flex items-center justify-center bg-bg-dark/70 rounded-xl backdrop-blur-sm">
              <div className="text-center space-y-3 px-6">
                <MapPin size={40} className="mx-auto text-text-secondary" />
                <p className="text-text-primary font-semibold">No encontramos canchas cerca</p>
                <p className="text-text-secondary text-sm">
                  Probá ampliando la búsqueda o buscá en otra zona
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List view */
        <div className="flex-1 px-4 pb-4 space-y-2 overflow-y-auto">
          {courtsLoading && courts.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : courts.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <MapPin size={40} className="mx-auto text-text-secondary" />
              <p className="text-text-primary font-semibold">Sin canchas cercanas</p>
            </div>
          ) : (
            courts.map((court) => (
              <Card key={court.id}>
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-lg" aria-hidden="true">🎾</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{court.name}</p>
                    <p className="text-xs text-text-secondary">
                      {court.lat.toFixed(4)}, {court.lng.toFixed(4)}
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
