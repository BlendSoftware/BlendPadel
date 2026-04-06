import { useEffect, useState, useTransition } from 'react'
import { MapPin, RefreshCw, AlertCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useRankingsStore } from '@/stores/rankings-store'
import { useAuthStore } from '@/stores/auth-store'
import { RankingTable } from './RankingTable'
import { RegionPicker } from './RegionPicker'

export function RankingsPage() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [isRefreshing, startRefreshTransition] = useTransition()

  // ── Store selectors (individual — no destructuring) ────────────────────────
  const selectedRegionId = useRankingsStore((s) => s.selectedRegionId)
  const regions = useRankingsStore((s) => s.regions)
  const rankings = useRankingsStore((s) => s.rankings)
  const myPosition = useRankingsStore((s) => s.myPosition)
  const loading = useRankingsStore((s) => s.loading)
  const regionsLoading = useRankingsStore((s) => s.regionsLoading)
  const error = useRankingsStore((s) => s.error)
  const fetchRegions = useRankingsStore((s) => s.fetchRegions)
  const fetchRankings = useRankingsStore((s) => s.fetchRankings)
  const setRegion = useRankingsStore((s) => s.setRegion)
  const clearError = useRankingsStore((s) => s.clearError)
  const refresh = useRankingsStore((s) => s.refresh)
  const genderFilter = useRankingsStore((s) => s.genderFilter)
  const setGenderFilter = useRankingsStore((s) => s.setGenderFilter)

  const user = useAuthStore((s) => s.user)

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    void fetchRegions()
    void fetchRankings()
  }, [fetchRegions, fetchRankings])

  // ── Derived: label for active region chip ──────────────────────────────────
  const activeRegionLabel =
    selectedRegionId === null
      ? 'Todas las regiones'
      : (regions.find((r) => r.id === selectedRegionId)?.name ?? 'Región')

  // ── Pull-to-refresh handler ────────────────────────────────────────────────
  const handleRefresh = () => {
    startRefreshTransition(() => {
      void refresh()
    })
  }

  const handleRetry = () => {
    clearError()
    void fetchRankings()
  }

  return (
    <div className="flex flex-col min-h-full bg-bg-dark page-enter">
      {/* Header with region chip on the right */}
      <Header
        title="Rankings"
        right={
          <button
            onClick={() => setPickerOpen(true)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors min-h-11',
              'text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green',
              'bg-bg-card border-border text-text-primary hover:border-padel-green/50',
            ].join(' ')}
            aria-label="Cambiar región"
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
          >
            <MapPin size={14} className="text-padel-green shrink-0" aria-hidden="true" />
            <span className="max-w-[120px] truncate">{activeRegionLabel}</span>
            {regionsLoading && <Spinner size="sm" className="ml-1" />}
          </button>
        }
      />

      <div className="flex-1 px-4 pt-4 pb-6 flex flex-col gap-4">
        {/* Gender filter tabs */}
        <div className="flex gap-2" role="tablist" aria-label="Filtrar por género">
          {([
            { value: null, label: 'Todos' },
            { value: 'male', label: 'Masculino' },
            { value: 'female', label: 'Femenino' },
          ] as const).map((tab) => {
            const isActive = genderFilter === tab.value
            return (
              <button
                key={tab.label}
                role="tab"
                aria-selected={isActive}
                onClick={() => setGenderFilter(tab.value)}
                className={[
                  'flex-1 px-3 py-2 rounded-xl text-sm font-medium min-h-11 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green',
                  isActive
                    ? 'bg-padel-green text-bg-dark'
                    : 'bg-bg-card text-text-secondary border border-border hover:text-text-primary hover:border-border/80',
                ].join(' ')}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Refresh button */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-secondary">
            Top jugadores de{' '}
            <span className="text-padel-green font-medium">{activeRegionLabel}</span>
          </p>
          <button
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border min-h-11',
              'text-xs text-text-secondary hover:text-text-primary hover:border-border/80 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            ].join(' ')}
            aria-label="Actualizar ranking"
          >
            <RefreshCw
              size={13}
              className={isRefreshing || loading ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            Actualizar
          </button>
        </div>

        {/* Error state */}
        {error && !loading && (
          <div
            className="flex items-start gap-3 rounded-xl border border-trust-low/30 bg-trust-low/10 px-4 py-3"
            role="alert"
          >
            <AlertCircle size={18} className="text-trust-low mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary font-medium">Error al cargar</p>
              <p className="text-xs text-text-secondary mt-0.5">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className="shrink-0 text-trust-low hover:text-trust-low/80"
            >
              Reintentar
            </Button>
          </div>
        )}

        {/* Leaderboard table — BUG 3 FIX: only render when no error */}
        {!error && (
          <RankingTable
            rankings={rankings}
            myPosition={myPosition}
            currentUserId={user?.id ?? null}
            loading={loading}
          />
        )}
      </div>

      {/* Region picker modal */}
      {pickerOpen && (
        <RegionPicker
          regions={regions}
          selectedRegionId={selectedRegionId}
          loading={regionsLoading}
          onSelect={setRegion}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
