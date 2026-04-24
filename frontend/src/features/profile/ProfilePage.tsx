import { useEffect } from 'react'
import {
  Camera,
  ChevronRight,
  Key,
  LogOut,
  MapPin,
  Pencil,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Users,
  ShieldCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { EloChart } from './components/EloChart'
import { MatchHistoryList } from './components/MatchHistoryList'
import { CategoryBadge } from '@/components/ui/CategoryBadge'

import styles from './ProfilePage.module.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trustCss(score: number): string {
  if (score >= 90) return styles.trustHigh
  if (score >= 70) return styles.trustMedium
  return styles.trustLow
}

function trustLabel(score: number): string {
  if (score >= 90) return 'Confianza excelente'
  if (score >= 70) return 'Confianza buena'
  return 'Confianza baja'
}

// ─── ActionRow ────────────────────────────────────────────────────────────────

function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button className={styles.actionRow} onClick={onClick}>
      <span className={styles.actionIcon}>{icon}</span>
      <span className={styles.actionLabel}>{label}</span>
      <ChevronRight size={16} className={styles.actionChevron} />
    </button>
  )
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────

export function ProfilePage() {
  const navigate = useNavigate()
  const logout   = useAuthStore((s) => s.logout)
  const user     = useAuthStore((s) => s.user)
  const isAdmin  = user?.role === 'superadmin' || user?.role === 'moderator'

  const profile          = useProfileStore((s) => s.profile)
  const eloHistory       = useProfileStore((s) => s.eloHistory)
  const matchHistory     = useProfileStore((s) => s.matchHistory)
  const hasMoreMatches   = useProfileStore((s) => s.hasMoreMatches)
  const loading          = useProfileStore((s) => s.loading)
  const error            = useProfileStore((s) => s.error)
  const fetchProfile     = useProfileStore((s) => s.fetchProfile)
  const fetchEloHistory  = useProfileStore((s) => s.fetchEloHistory)
  const fetchMatchHistory = useProfileStore((s) => s.fetchMatchHistory)

  useEffect(() => {
    fetchProfile()
    fetchEloHistory()
    fetchMatchHistory(undefined, true)
  }, [fetchProfile, fetchEloHistory, fetchMatchHistory])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  // Loading
  if (loading && !profile) {
    return (
      <div className={`${styles.page} page-enter`}>
        <div className={styles.topBar}>
          <h1 className={styles.pageTitle}>Perfil</h1>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  // Error
  if (error && !profile) {
    return (
      <div className={`${styles.page} page-enter`}>
        <div className={styles.topBar}>
          <h1 className={styles.pageTitle}>Perfil</h1>
        </div>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: 16 }}>{error}</p>
          <Button variant="outline" onClick={() => fetchProfile()}>Reintentar</Button>
        </div>
      </div>
    )
  }

  if (!profile) return null

  const lastElo         = eloHistory.length >= 2 ? eloHistory[eloHistory.length - 1] : null
  const eloDelta        = lastElo?.delta ?? 0
  const isCalibrating   = (profile.calibration_matches_remaining ?? 0) > 0
  const fullName        = [profile.name, profile.last_name].filter(Boolean).join(' ').trim() || profile.name

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <h1 className={styles.pageTitle}>Perfil</h1>
        <button
          className={styles.topAction}
          onClick={() => navigate('/profile/preferences')}
          aria-label="Preferencias"
          title="Preferencias de matchmaking"
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      <div className={styles.body}>

        {/* ── Hero card ── */}
        <div className={styles.heroCard}>
          <button
            className={styles.avatarBtn}
            onClick={() => navigate('/profile/avatar')}
            aria-label="Cambiar avatar"
          >
            <Avatar src={profile.avatar_url} name={fullName} size="xl" />
            <div className={styles.avatarOverlay}>
              <Camera size={20} />
            </div>
          </button>

          <div className={styles.nameBlock}>
            <p className={styles.displayName}>{fullName}</p>
            {profile.email && <p className={styles.email}>{profile.email}</p>}
          </div>

          <div className={styles.eloDisplay}>
            <div className={styles.eloRow}>
              <span className={styles.eloNum}>{profile.elo}</span>
              {eloDelta !== 0 && (
                <span className={`${styles.eloDelta} ${eloDelta > 0 ? styles.eloDeltaUp : styles.eloDeltaDown}`}>
                  {eloDelta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {eloDelta > 0 ? `+${eloDelta}` : eloDelta}
                </span>
              )}
            </div>
            <CategoryBadge elo={profile.elo} showFull />
          </div>

          {profile.trust_score !== undefined && (
            <span className={`${styles.trustBadge} ${trustCss(profile.trust_score)}`}>
              {trustLabel(profile.trust_score)}
            </span>
          )}
        </div>

        {/* ── Calibration / Stats ── */}
        {isCalibrating ? (
          <div className={styles.calibrationBanner}>
            <p className={styles.calibrationText}>
              En calibración &mdash; te faltan{' '}
              <span className={styles.calibrationAccent}>
                {profile.calibration_matches_remaining} partidos
              </span>{' '}
              para aparecer en el ranking
            </p>
          </div>
        ) : (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{profile.validated_match_count}</span>
              <span className={styles.statLabel}>Partidos jugados</span>
            </div>
            <div className={styles.statCard}>
              <span className={`${styles.statValue} ${styles.statValueAccent}`}>{profile.elo}</span>
              <span className={styles.statLabel}>ELO actual</span>
            </div>
          </div>
        )}

        {/* ── ELO Chart ── */}
        {eloHistory.length > 0 && (
          <div className={styles.chartCard}>
            <p className={styles.sectionLabel}>Historial ELO</p>
            <EloChart entries={eloHistory} />
          </div>
        )}

        {/* ── Quick actions ── */}
        <div className={styles.actionList}>
          <ActionRow icon={<Pencil size={16} />} label="Editar perfil"                 onClick={() => navigate('/profile/edit')} />
          <ActionRow icon={<SlidersHorizontal size={16} />} label="Preferencias de matchmaking" onClick={() => navigate('/profile/preferences')} />
          <ActionRow icon={<MapPin size={16} />} label="Mis Canchas"                   onClick={() => navigate('/venues')} />
          <ActionRow icon={<Users size={16} />}  label="Mis Parejas"                   onClick={() => navigate('/partnerships')} />
          <ActionRow icon={<Key size={16} />}    label="Cambiar contraseña"             onClick={() => navigate('/change-password')} />
          {isAdmin && (
            <ActionRow icon={<ShieldCheck size={16} />} label="Panel Admin" onClick={() => navigate('/admin')} />
          )}
        </div>

        {/* ── Match history ── */}
        <div className={styles.historySection}>
          <p className={styles.sectionLabel}>Últimos partidos</p>
          <MatchHistoryList
            matches={matchHistory}
            hasMore={hasMoreMatches}
            loading={loading && matchHistory.length > 0}
            onLoadMore={() => fetchMatchHistory(undefined, false)}
          />
        </div>

        {/* ── Logout ── */}
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
