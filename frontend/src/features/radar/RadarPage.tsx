import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  MapPin,
  Navigation,
  Compass,
  Plus,
  Activity,
  RefreshCw,
  SlidersHorizontal,
  X,
  ChevronUp,
  Clock,
  Users,
  Zap,
  Target,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  Shield,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'

import { Spinner } from '@/components/ui/Spinner'
import { useRadarStore } from '@/stores/radar-store'
import type { PadelCourt, RadarMatch, ELORange, RadiusOption } from '@/types/radar'
import { CourtsMap } from './components/CourtsMap'

import styles from './RadarPage.module.css'

// ─── Constants ────────────────────────────────────────────────────────────────
const MENDOZA = { lat: -33.35, lng: -68.33 }
const RADIUS_OPTIONS: RadiusOption[] = [5, 10, 15, 25]
const ELO_MIN = 400
const ELO_MAX = 2000

// ─── Animation variants (mount-only, not per-item) ───────────────────────────
const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] } },
}

// ─── ELO helpers ─────────────────────────────────────────────────────────────
function eloLabel(elo: number): string {
  if (elo < 700)  return 'Rookie'
  if (elo < 900)  return 'Amateur'
  if (elo < 1100) return 'Intermedio'
  if (elo < 1300) return 'Avanzado'
  if (elo < 1500) return 'Elite'
  return 'Pro'
}

function eloColor(elo: number): string {
  if (elo < 700)  return '#888'
  if (elo < 900)  return '#64b5f6'
  if (elo < 1100) return '#81c784'
  if (elo < 1300) return '#d7ff2d'
  if (elo < 1500) return '#ffb74d'
  return '#f06292'
}

function eloPct(elo: number): number {
  return Math.min(100, Math.max(0, ((elo - ELO_MIN) / (ELO_MAX - ELO_MIN)) * 100))
}

// ─── PlayerSlots ─────────────────────────────────────────────────────────────
function PlayerSlots({
  confirmed,
  max,
}: {
  confirmed: number
  max: number
}) {
  return (
    <div className={styles.playerSlots}>
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`${styles.playerSlot} ${i < confirmed ? styles.playerSlotFilled : ''}`}
        />
      ))}
    </div>
  )
}

// ─── MatchCard — pure CSS animations (no Framer Motion per-card) ──────────────
function MatchCard({
  match,
  onClick,
  index,
}: {
  match: RadarMatch
  onClick: () => void
  index: number
}) {
  // Backend returns joined_count (respondents so far). Padel is always 4 total.
  const MAX_PLAYERS = 4
  const slotsLeft = MAX_PLAYERS - match.joined_count
  const isUrgent  = slotsLeft === 1
  const isFull    = slotsLeft <= 0
  const color     = eloColor(match.avg_elo)
  const distKm    = (match.distance_meters / 1000).toFixed(1)

  const time = new Date(match.scheduled_at).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

  return (
    <button
      className={`${styles.matchCard} ${isUrgent ? styles.matchCardUrgent : ''} ${isFull ? styles.matchCardFull : ''}`}
      style={{
        animationDelay: `${index * 60}ms`,
        '--elo-color': color,
        '--elo-pct': `${eloPct(match.avg_elo)}%`,
      } as React.CSSProperties}
      onClick={onClick}
    >
      {/* Gradient border accent */}
      <div className={styles.matchCardBorderAccent} style={{ background: isUrgent ? '#ff6464' : color }} />

      {/* Top row */}
      <div className={styles.matchCardTop}>
        {/* Time block — visual anchor */}
        <div className={styles.matchCardTime}>
          <Clock size={11} className={styles.timeIcon} />
          <span className={styles.timeVal}>{time}</span>
        </div>

        {/* Status badge */}
        {isUrgent && (
          <span className={styles.urgentBadge}>
            <Zap size={10} strokeWidth={3} />
            ¡Falta 1!
          </span>
        )}
        {isFull && (
          <span className={styles.fullBadge}>
            <Shield size={10} />
            Completo
          </span>
        )}
      </div>

      {/* Captain & location */}
      <div className={styles.matchCardBody}>
        <p className={styles.matchCardTitle}>{match.captain_name}</p>
        <p className={styles.matchCardLocation}>
          <MapPin size={10} />
          <span className={styles.distanceDot}>·</span>
          {distKm} km
        </p>
      </div>

      {/* ELO + player slots row */}
      <div className={styles.matchCardFooter}>
        {/* ELO section */}
        <div className={styles.eloSection}>
          <div className={styles.eloTopRow}>
            <TrendingUp size={11} className={styles.eloIcon} style={{ color }} />
            <span className={styles.eloNum} style={{ color }}>{match.avg_elo.toLocaleString()}</span>
            <span className={styles.eloTag}>{eloLabel(match.avg_elo)}</span>
          </div>
          <div className={styles.eloBar}>
            <div
              className={styles.eloFill}
              style={{ width: `${eloPct(match.avg_elo)}%`, background: color }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className={styles.footerDivider} />

        {/* Players section */}
        <div className={styles.playersSection}>
          <div className={styles.playersSlotsRow}>
            <PlayerSlots confirmed={match.joined_count} max={MAX_PLAYERS} />
            <span className={styles.slotsLabel}>
              {slotsLeft > 0 ? `${slotsLeft} libre${slotsLeft !== 1 ? 's' : ''}` : 'Completo'}
            </span>
          </div>
          <p className={styles.playersCount}>
            {match.joined_count}/{MAX_PLAYERS} jugadores
          </p>
        </div>
      </div>

      {/* Arrow indicator */}
      <ArrowRight size={14} className={styles.matchCardArrow} />
    </button>
  )
}

// ─── FilterPanel (filter expand animado con CSS max-height) ───────────────────
function FilterPanel({
  eloRange, radiusKm, onELOChange, onRadiusChange, onReset, open, onToggle,
}: {
  eloRange: ELORange; radiusKm: RadiusOption
  onELOChange: (r: ELORange) => void; onRadiusChange: (r: RadiusOption) => void
  onReset: () => void; open: boolean; onToggle: () => void
}) {
  const [local, setLocal] = useState(eloRange)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setLocal(eloRange) }, [eloRange.min, eloRange.max]) // eslint-disable-line

  const isModified = radiusKm !== 10 || local.min !== 800 || local.max !== 1400

  function schedule(next: ELORange) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onELOChange(next), 400)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  return (
    <div className={styles.filterWrap}>
      <button
        className={`${styles.filterToggle} ${open ? styles.filterToggleOpen : ''}`}
        onClick={onToggle}
      >
        <span className={styles.filterToggleLeft}>
          <SlidersHorizontal size={15} />
          Filtros
          {isModified && <span className={styles.filterDot} />}
        </span>
        <span className={styles.filterToggleRight}>
          {radiusKm} km · ELO {local.min}–{local.max}
          <ChevronUp size={14} className={open ? '' : styles.rotated} />
        </span>
      </button>

      {/* CSS max-height transition — GPU compositor, no JS */}
      <div className={`${styles.filterPanel} ${open ? styles.filterPanelOpen : ''}`}>
        <div className={styles.filterPanelInner}>
          {/* Radius */}
          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Radio de búsqueda</legend>
            <div className={styles.radiusRow}>
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  className={`${styles.radiusBtn} ${radiusKm === r ? styles.radiusBtnActive : ''}`}
                  onClick={() => onRadiusChange(r)}
                >
                  {r} km
                </button>
              ))}
            </div>
          </fieldset>

          {/* ELO sliders */}
          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Rango ELO</legend>
            <div className={styles.sliderRow}>
              <label className={styles.sliderLabel}>
                <span>Mínimo</span>
                <span className={styles.sliderValue}>{local.min}</span>
              </label>
              <input
                type="range" min={ELO_MIN} max={ELO_MAX} step={50}
                value={local.min}
                onChange={(e) => {
                  const v = Math.min(Number(e.target.value), local.max - 50)
                  const next = { ...local, min: v }
                  setLocal(next)
                  schedule(next)
                }}
                className={styles.slider}
              />
            </div>
            <div className={styles.sliderRow}>
              <label className={styles.sliderLabel}>
                <span>Máximo</span>
                <span className={styles.sliderValue}>{local.max}</span>
              </label>
              <input
                type="range" min={ELO_MIN} max={ELO_MAX} step={50}
                value={local.max}
                onChange={(e) => {
                  const v = Math.max(Number(e.target.value), local.min + 50)
                  const next = { ...local, max: v }
                  setLocal(next)
                  schedule(next)
                }}
                className={styles.slider}
              />
            </div>
          </fieldset>

          <button className={styles.resetBtn} onClick={onReset}>
            <X size={12} /> Restablecer filtros
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Match Detail Bottom Sheet ─────────────────────────────────────────────────
function MatchSheet({
  match, onClose, onJoin,
}: {
  match: RadarMatch | null; onClose: () => void; onJoin: (id: string) => void
}) {
  useEffect(() => {
    if (!match) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [match, onClose])

  useEffect(() => {
    document.body.style.overflow = match ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [match])

  if (!match) {
    return (
      <>
        <div className={styles.sheetBackdrop} />
        <div className={styles.sheet} />
      </>
    )
  }

  const MAX_PLAYERS = 4
  const slotsLeft = MAX_PLAYERS - match.joined_count
  const isUrgent  = slotsLeft === 1
  const color     = eloColor(match.avg_elo)
  const distKm    = (match.distance_meters / 1000).toFixed(1)
  const time      = new Date(match.scheduled_at).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

  return (
    <>
      <div
        className={`${styles.sheetBackdrop} ${styles.sheetBackdropOpen}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`${styles.sheet} ${styles.sheetOpen}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Partido de ${match.captain_name}`}
      >
        <div className={styles.sheetHandle} />

        {/* Top accent bar */}
        <div
          className={styles.sheetAccentBar}
          style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
        />

        <div className={styles.sheetContent}>
          {/* Header */}
          <div className={styles.sheetHeader}>
            <div className={styles.sheetHeaderLeft}>
              <div className={styles.sheetELOBadge} style={{ color, borderColor: `${color}33`, background: `${color}10` }}>
                {eloLabel(match.avg_elo)}
              </div>
              <h2 className={styles.sheetTitle}>{match.captain_name}</h2>
              {isUrgent && (
                <p className={styles.sheetUrgent}>
                  <Zap size={12} /> ¡Solo queda 1 lugar!
                </p>
              )}
            </div>
            <button className={styles.sheetClose} onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          {/* Stats 2x2 grid */}
          <div className={styles.sheetGrid}>
            <div className={styles.sheetStat}>
              <Clock size={16} className={styles.sheetStatIcon} />
              <p className={styles.sheetStatSub}>Horario</p>
              <p className={styles.sheetStatVal}>{time}</p>
            </div>
            <div className={styles.sheetStat}>
              <MapPin size={16} className={styles.sheetStatIcon} />
              <p className={styles.sheetStatSub}>Distancia</p>
              <p className={styles.sheetStatVal}>{distKm} km</p>
            </div>
            <div className={styles.sheetStat}>
              <Users size={16} className={styles.sheetStatIcon} />
              <p className={styles.sheetStatSub}>Jugadores</p>
              <p className={styles.sheetStatVal}>{match.joined_count}<span className={styles.sheetStatOf}>/{MAX_PLAYERS}</span></p>
            </div>
            <div className={styles.sheetStat}>
              <TrendingUp size={16} className={styles.sheetStatIcon} style={{ color }} />
              <p className={styles.sheetStatSub}>ELO prom.</p>
              <p className={styles.sheetStatVal} style={{ color }}>{match.avg_elo.toLocaleString()}</p>
            </div>
          </div>

          {/* Player slots visual */}
          <div className={styles.sheetPlayerSlots}>
            <p className={styles.sheetPlayerSlotsLabel}>
              Ocupación · {slotsLeft > 0 ? `${slotsLeft} lugar${slotsLeft !== 1 ? 'es' : ''} libre${slotsLeft !== 1 ? 's' : ''}` : 'Partido completo'}
            </p>
            <div className={styles.sheetSlotsRow}>
              {Array.from({ length: MAX_PLAYERS }).map((_, i) => (
                <div
                  key={i}
                  className={`${styles.sheetSlot} ${i < match.joined_count ? styles.sheetSlotFilled : ''}`}
                  style={i < match.joined_count ? { borderColor: color, background: `${color}20` } : {}}
                >
                  {i < match.joined_count && (
                    <Users size={10} style={{ color }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ELO bar */}
          <div className={styles.sheetELOBar}>
            <div className={styles.sheetELOBarTrack}>
              <div
                className={styles.sheetELOBarFill}
                style={{ width: `${eloPct(match.avg_elo)}%`, background: color, boxShadow: `0 0 12px ${color}60` }}
              />
            </div>
            <div className={styles.sheetELOLabels}>
              <span>Rookie</span>
              <span>Pro</span>
            </div>
          </div>

          {/* CTA */}
          <button
            className={`${styles.sheetCta} ${slotsLeft <= 0 ? styles.sheetCtaDisabled : ''}`}
            onClick={() => slotsLeft > 0 && onJoin(match.id)}
            disabled={slotsLeft <= 0}
          >
            {slotsLeft <= 0 ? 'Partido Completo' : 'Quiero jugar'}
            {slotsLeft > 0 && <ArrowRight size={18} />}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── StatPill ─────────────────────────────────────────────────────────────────
function StatPill({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className={styles.statPill}>
      <span className={styles.statPillIcon}>{icon}</span>
      <div>
        <p className={styles.statPillValue}>{value}</p>
        <p className={styles.statPillLabel}>{label}</p>
      </div>
    </div>
  )
}

// ─── EmptyMatches ─────────────────────────────────────────────────────────────
function EmptyMatches({ onCreateMatch }: { onCreateMatch: () => void }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <Target size={28} />
      </div>
      <p className={styles.emptyTitle}>Sin partidos en la zona</p>
      <p className={styles.emptyDesc}>Sé el primero en convocar uno.</p>
      <button className={styles.emptyBtn} onClick={onCreateMatch}>
        <Plus size={16} /> Crear partida
      </button>
    </div>
  )
}

// ─── LocationDenied ────────────────────────────────────────────────────────────
function LocationDenied({ onUseMendoza }: { onUseMendoza: () => void }) {
  return (
    <div className={styles.centerStage}>
      <motion.div className={styles.gateCard} initial="hidden" animate="visible" variants={fadeUp}>
        <div className={styles.gateIconWrap}>
          <AlertCircle size={36} className={styles.gateIcon} />
        </div>
        <h1 className={styles.gateTitle}>Ubicación Inactiva</h1>
        <p className={styles.gateDesc}>
          Activá el radar para encontrar partidas reales en tu zona. O usá Mendoza como base.
        </p>
        <button onClick={onUseMendoza} className={styles.gateCta}>
          <Navigation size={16} /> Conectar Área Mendoza
        </button>
      </motion.div>
    </div>
  )
}

// ─── RadarPage ─────────────────────────────────────────────────────────────────
export function RadarPage() {
  const navigate = useNavigate()

  const userLocation    = useRadarStore((s) => s.userLocation)
  const locationDenied  = useRadarStore((s) => s.locationDenied)
  const matches         = useRadarStore((s) => s.matches)
  const isLoading       = useRadarStore((s) => s.isLoading)
  const eloRange        = useRadarStore((s) => s.eloRange)
  const radiusKm        = useRadarStore((s) => s.radiusKm)
  const selectedMatchId = useRadarStore((s) => s.selectedMatchId)

  const setUserLocation   = useRadarStore((s) => s.setUserLocation)
  const setLocationDenied = useRadarStore((s) => s.setLocationDenied)
  const setELORange       = useRadarStore((s) => s.setELORange)
  const setRadiusKm       = useRadarStore((s) => s.setRadiusKm)
  const selectMatch       = useRadarStore((s) => s.selectMatch)
  const fetchMatches      = useRadarStore((s) => s.fetchMatches)
  const refresh           = useRadarStore((s) => s.refresh)

  const [geoInitialized, setGeoInitialized] = useState(false)
  const [courts, setCourts]                 = useState<PadelCourt[]>([])
  const [courtsLoading, setCourtsLoading]   = useState(false)
  const [filterOpen, setFilterOpen]         = useState(false)
  const [refreshing, setRefreshing]         = useState(false)

  // Geolocation init
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
      () => { if (!userLocation) setLocationDenied(true) },
      { timeout: 8000, maximumAge: 60_000 },
    )
  }, [geoInitialized, setLocationDenied, setUserLocation, userLocation])

  // Fetch matches on location / filter change
  useEffect(() => {
    if (!userLocation) return
    fetchMatches()
  }, [userLocation?.lat, userLocation?.lng, eloRange.min, eloRange.max, radiusKm]) // eslint-disable-line

  // Fetch courts from Overpass with localStorage cache
  useEffect(() => {
    const lat = userLocation?.lat
    const lng = userLocation?.lng
    if (lat == null || lng == null) return

    const cacheKey = `blend-v3-courts-${lat.toFixed(1)},${lng.toFixed(1)}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 30 * 60 * 1000) { setCourts(data); return }
      }
    } catch {}

    setCourtsLoading(true)
    const radius = 30000
    const query  = `[out:json][timeout:25];(node["sport"~"padel|paddle"](around:${radius},${lat},${lng});way["sport"~"padel|paddle"](around:${radius},${lat},${lng});node["leisure"="pitch"]["sport"~"padel|paddle"](around:${radius},${lat},${lng});way["leisure"="pitch"]["sport"~"padel|paddle"](around:${radius},${lat},${lng});node["name"~"padel|paddle",i](around:${radius},${lat},${lng});way["name"~"padel|paddle",i](around:${radius},${lat},${lng}););out center;`

    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
      .then((r) => r.json())
      .then((data) => {
        const seen    = new Set<number>()
        const results: PadelCourt[] = (data.elements ?? [])
          .filter((el: any) => {
            if ((el.lat ?? el.center?.lat) == null) return false
            if (seen.has(el.id)) return false
            seen.add(el.id)
            return true
          })
          .map((el: any) => ({
            id: el.id,
            name: el.tags?.name || 'Cancha de padel',
            lat: el.lat ?? el.center?.lat,
            lng: el.lon ?? el.center?.lon,
          }))
        setCourts(results)
        setCourtsLoading(false)
        try { localStorage.setItem(cacheKey, JSON.stringify({ data: results, ts: Date.now() })) } catch {}
      })
      .catch(() => setCourtsLoading(false))
  }, [userLocation?.lat, userLocation?.lng]) // eslint-disable-line

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setTimeout(() => setRefreshing(false), 700)
  }, [refresh])

  const handleResetFilters = useCallback(() => {
    setELORange({ min: 800, max: 1400 })
    setRadiusKm(10)
  }, [setELORange, setRadiusKm])

  const handleUseMendoza = useCallback(() => {
    setUserLocation(MENDOZA)
    setLocationDenied(false)
  }, [setUserLocation, setLocationDenied])

  const selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? null

  // ── Guards ──
  if (locationDenied && !userLocation) {
    return <LocationDenied onUseMendoza={handleUseMendoza} />
  }

  if (!userLocation) {
    return (
      <div className={styles.centerStage}>
        <motion.div className={styles.gateCard} initial="hidden" animate="visible" variants={fadeUp}>
          <Spinner size="lg" />
          <h1 className={styles.gateTitle}>Calibrando Radar</h1>
          <p className={styles.gateDesc}>Detectando tu posición…</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className={styles.root}>

      {/* ── LEFT: Map panel ─────────────────────────────────── */}
      <section className={styles.mapPanel}>
        <div className={styles.mapCard}>
          <div className={styles.mapCardHeader}>
            <div>
              <p className={styles.mapKicker}>Zona activa</p>
              <h2 className={styles.mapCardTitle}>Zona de Juego</h2>
            </div>
            <div className={styles.mapHeaderRight}>
              <span className={styles.badgeLive}>
                <span className={styles.pulse} /> LIVE
              </span>
              {courtsLoading && <Spinner size="sm" />}
            </div>
          </div>

          <div className={styles.mapFrame}>
            <CourtsMap
              userLocation={userLocation}
              courts={courts}
              loading={courtsLoading}
              onCenterChanged={(c) => setUserLocation(c)}
            />
          </div>

          <div className={styles.mapFooter}>
            <StatPill icon={<MapPin size={14} />}    value={courts.length}   label="Canchas" />
            <StatPill icon={<Activity size={14} />}  value={matches.length}  label="Partidas" />
            <StatPill icon={<Navigation size={14} />} value={`${radiusKm} km`} label="Radio" />
          </div>
        </div>
      </section>

      {/* ── RIGHT: Feed panel ───────────────────────────────── */}
      <section className={styles.feedPanel}>

        {/* Header */}
        <header className={styles.feedHeader}>
          <div className={styles.feedTitleGroup}>
            <p className={styles.feedKicker}>Señal Activa</p>
            <h1 className={styles.feedTitle}>RADAR</h1>
          </div>
          <div className={styles.feedHeaderActions}>
            <button
              className={`${styles.actionIconBtn} ${refreshing ? styles.spinning : ''}`}
              onClick={handleRefresh}
              aria-label="Actualizar"
              title="Actualizar"
            >
              <RefreshCw size={18} />
            </button>
            <button
              className={`${styles.actionIconBtn} ${filterOpen ? styles.actionIconBtnActive : ''}`}
              onClick={() => setFilterOpen((o) => !o)}
              aria-label="Filtros"
              title="Filtros"
            >
              <SlidersHorizontal size={18} />
            </button>
            <button
              className={styles.actionIconBtn}
              onClick={() => navigate('/matchmaking')}
              aria-label="Matchmaking"
              title="Ir a Matchmaking"
            >
              <Compass size={18} />
            </button>
          </div>
        </header>

        {/* Hero CTA */}
        <motion.div
          className={styles.heroCTA}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <div className={styles.heroContent}>
            <h2 className={styles.heroTitle}>NUEVO<br />ENCUENTRO</h2>
            <p className={styles.heroDesc}>
              Convocá jugadores en tu nivel ELO automáticamente.
            </p>
          </div>
          <button
            className={styles.heroBtn}
            onClick={() => navigate('/matchmaking/new')}
            aria-label="Crear nueva partida"
          >
            <Plus size={28} strokeWidth={3} />
          </button>
        </motion.div>

        {/* Filters */}
        <FilterPanel
          eloRange={eloRange}
          radiusKm={radiusKm}
          onELOChange={setELORange}
          onRadiusChange={setRadiusKm}
          onReset={handleResetFilters}
          open={filterOpen}
          onToggle={() => setFilterOpen((o) => !o)}
        />

        {/* Matches */}
        <div className={styles.matchesSection}>
          <div className={styles.matchesSectionHeader}>
            <h3 className={styles.matchesSectionTitle}>
              Partidas Cercanas
              {!isLoading && <span className={styles.matchCount}>{matches.length}</span>}
            </h3>
          </div>

          {isLoading ? (
            <div className={styles.matchesLoading}>
              <Spinner size="md" />
              <p>Buscando partidas…</p>
            </div>
          ) : matches.length === 0 ? (
            <EmptyMatches onCreateMatch={() => navigate('/matchmaking/new')} />
          ) : (
            <div className={styles.matchesList}>
              {matches.map((match, i) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  index={i}
                  onClick={() => selectMatch(match.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ height: 40 }} />
      </section>

      {/* ── Match bottom sheet ─────────────────────────────── */}
      <MatchSheet
        match={selectedMatch}
        onClose={() => selectMatch(null)}
        onJoin={(id) => { selectMatch(null); navigate(`/matches/${id}`) }}
      />
    </div>
  )
}
