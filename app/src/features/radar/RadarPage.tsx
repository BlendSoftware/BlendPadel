import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Zap } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

import { Header } from '@/components/layout/Header'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

import { AlertBanner } from './components/AlertBanner'
import { RadarMap } from './components/RadarMap'
import { ELOFilterPanel } from './components/ELOFilterPanel'
import { MatchDetailSheet } from './components/MatchDetailSheet'
import { RadarEmptyState } from './components/RadarEmptyState'
import { LocationDeniedScreen } from './components/LocationDeniedScreen'

import { useRadarStore } from '@/stores/radar-store'
import type { RadarMatch, RadarAlert, UserLocation, RadiusOption } from '@/types/radar'

// ─── Auto-refresh interval ────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 30_000
// Mendoza default
const MENDOZA: UserLocation = { lat: -33.35, lng: -68.33 }

// ─── Individual selectors (CRITICAL: never destructure store) ─────────────────
const selectMatches = (s: ReturnType<typeof useRadarStore.getState>) => s.matches
const selectAlerts = (s: ReturnType<typeof useRadarStore.getState>) => s.alerts
const selectUserLocation = (s: ReturnType<typeof useRadarStore.getState>) => s.userLocation
const selectEloRange = (s: ReturnType<typeof useRadarStore.getState>) => s.eloRange
const selectRadiusKm = (s: ReturnType<typeof useRadarStore.getState>) => s.radiusKm
const selectSelectedMatchId = (s: ReturnType<typeof useRadarStore.getState>) => s.selectedMatchId
const selectIsLoading = (s: ReturnType<typeof useRadarStore.getState>) => s.isLoading
const selectError = (s: ReturnType<typeof useRadarStore.getState>) => s.error
const selectLocationDenied = (s: ReturnType<typeof useRadarStore.getState>) => s.locationDenied
const selectFetchMatches = (s: ReturnType<typeof useRadarStore.getState>) => s.fetchMatches
const selectFetchAlerts = (s: ReturnType<typeof useRadarStore.getState>) => s.fetchAlerts
const selectSetUserLocation = (s: ReturnType<typeof useRadarStore.getState>) => s.setUserLocation
const selectSetLocationDenied = (s: ReturnType<typeof useRadarStore.getState>) => s.setLocationDenied
const selectSetELORange = (s: ReturnType<typeof useRadarStore.getState>) => s.setELORange
const selectSetRadiusKm = (s: ReturnType<typeof useRadarStore.getState>) => s.setRadiusKm
const selectSelectMatch = (s: ReturnType<typeof useRadarStore.getState>) => s.selectMatch
const selectRefresh = (s: ReturnType<typeof useRadarStore.getState>) => s.refresh

export function RadarPage() {
  const navigate = useNavigate()

  // ── Store selectors ─────────────────────────────────────────────────────────
  const matches = useRadarStore(selectMatches)
  const alerts = useRadarStore(selectAlerts)
  const userLocation = useRadarStore(selectUserLocation)
  const eloRange = useRadarStore(selectEloRange)
  const radiusKm = useRadarStore(selectRadiusKm)
  const selectedMatchId = useRadarStore(selectSelectedMatchId)
  const isLoading = useRadarStore(selectIsLoading)
  const error = useRadarStore(selectError)
  const locationDenied = useRadarStore(selectLocationDenied)

  const fetchMatches = useRadarStore(selectFetchMatches)
  const fetchAlerts = useRadarStore(selectFetchAlerts)
  const setUserLocation = useRadarStore(selectSetUserLocation)
  const setLocationDenied = useRadarStore(selectSetLocationDenied)
  const setELORange = useRadarStore(selectSetELORange)
  const setRadiusKm = useRadarStore(selectSetRadiusKm)
  const selectMatch = useRadarStore(selectSelectMatch)
  const refresh = useRadarStore(selectRefresh)

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [alertsDismissed, setAlertsDismissed] = useState(false)
  const [geoInitialized, setGeoInitialized] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Geolocation on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (geoInitialized) return
    setGeoInitialized(true)

    if (!navigator.geolocation) {
      // Geolocation not supported — use stored or default
      if (!userLocation) {
        setUserLocation(MENDOZA)
      }
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationDenied(false)
      },
      () => {
        // Permission denied or error
        if (!userLocation) {
          // No cached location — show denied screen
          setLocationDenied(true)
        }
        // If we have a cached location, keep using it silently
      },
      { timeout: 8000, maximumAge: 60_000 },
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initial fetch when location becomes available ────────────────────────────
  useEffect(() => {
    if (!userLocation) return
    refresh()
  }, [userLocation]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-fetch when filters change ────────────────────────────────────────────
  useEffect(() => {
    if (!userLocation) return
    fetchMatches()
  }, [eloRange.min, eloRange.max, radiusKm]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-refresh every 30s ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userLocation) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      refresh()
    }, REFRESH_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [userLocation]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? null
  const visibleAlerts = alertsDismissed ? [] : alerts.slice(0, 5)

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleMarkerClick(match: RadarMatch) {
    selectMatch(match.id)
  }

  function handleSheetClose() {
    selectMatch(null)
  }

  function handleAlertClick(alert: RadarAlert) {
    const match = matches.find((m) => m.id === alert.match_id)
    if (match) selectMatch(match.id)
  }

  function handleSearchHere(loc: UserLocation) {
    setUserLocation(loc)
    fetchMatches()
    fetchAlerts()
  }

  function handleExpandRadius() {
    const options: RadiusOption[] = [5, 10, 15, 25]
    const currentIdx = options.indexOf(radiusKm)
    const nextRadius = options[Math.min(currentIdx + 1, options.length - 1)]
    setRadiusKm(nextRadius)
  }

  function handleUseMendoza() {
    setUserLocation(MENDOZA)
    setLocationDenied(false)
  }

  function handleLocationSet(loc: UserLocation) {
    setUserLocation(loc)
    setLocationDenied(false)
  }

  // ── Render: location denied ──────────────────────────────────────────────────
  if (locationDenied && !userLocation) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Radar" />
        <LocationDeniedScreen
          onLocationSet={handleLocationSet}
          onUseMendoza={handleUseMendoza}
        />
      </div>
    )
  }

  // ── Render: waiting for location ─────────────────────────────────────────────
  if (!userLocation) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Radar" />
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
      {/* Header */}
      <Header
        title="Radar"
        right={
          <div className="flex items-center gap-1">
            {/* Manual refresh button */}
            <button
              onClick={() => refresh()}
              disabled={isLoading}
              className="flex items-center justify-center min-h-11 min-w-11 text-text-secondary hover:text-padel-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg disabled:opacity-40"
              aria-label="Actualizar radar"
            >
              <RefreshCw
                size={18}
                className={isLoading ? 'animate-spin' : ''}
                aria-hidden="true"
              />
            </button>
            {/* BUG 5 FIX: Create flare button navigates to create-flare */}
            <button
              onClick={() => navigate('/matchmaking/create-flare')}
              className="flex items-center justify-center min-h-11 min-w-11 text-text-secondary hover:text-padel-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg"
              aria-label="Crear desafío"
            >
              <Zap size={20} aria-hidden="true" />
            </button>
          </div>
        }
      />

      {/* Alert banner */}
      {visibleAlerts.length > 0 && (
        <AlertBanner
          alerts={visibleAlerts}
          onDismiss={() => setAlertsDismissed(true)}
          onAlertClick={handleAlertClick}
        />
      )}

      {/* Filter panel */}
      <ELOFilterPanel
        eloRange={eloRange}
        radiusKm={radiusKm}
        onELORangeChange={setELORange}
        onRadiusChange={setRadiusKm}
      />

      {/* Map area — fills remaining space */}
      <div className="flex-1 mx-3 mb-3 relative" style={{ minHeight: '320px' }}>
        {/* Loading overlay on initial load */}
        {isLoading && matches.length === 0 && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-bg-dark/60 rounded-xl">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-text-secondary text-sm">Buscando partidos...</p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && matches.length === 0 && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-bg-dark/80 rounded-xl">
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="text-text-secondary text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={() => refresh()}>
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {/* The map — always rendered when we have a location */}
        <RadarMap
          matches={matches}
          userLocation={userLocation}
          onMarkerClick={handleMarkerClick}
          onSearchHere={handleSearchHere}
        />

        {/* Empty state overlay — over the map */}
        {!isLoading && matches.length === 0 && !error && (
          <div className="absolute inset-0 z-[999] flex items-center justify-center bg-bg-dark/70 rounded-xl backdrop-blur-sm">
            {/* BUG 5 FIX: onCreateMatch navigates to /matchmaking/new */}
          <RadarEmptyState
              radiusKm={radiusKm}
              onExpandRadius={handleExpandRadius}
              onCreateMatch={() => navigate('/matchmaking/new')}
            />
          </div>
        )}
      </div>

      {/* Match detail bottom sheet */}
      <MatchDetailSheet match={selectedMatch} onClose={handleSheetClose} />
    </div>
  )
}
