import { useEffect } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import { Spinner } from '@/components/ui/Spinner'
import { Users, Swords, AlertTriangle, TrendingUp, UserCog, Shield } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  accent?: boolean
  danger?: boolean
}

function KpiCard({ label, value, icon, accent, danger }: KpiCardProps) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div
        className={[
          'w-10 h-10 rounded-lg flex items-center justify-center',
          accent ? 'bg-padel-green/15 text-padel-green' : '',
          danger ? 'bg-trust-low/15 text-trust-low' : '',
          !accent && !danger ? 'bg-bg-input text-text-secondary' : '',
        ].join(' ')}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-display text-text-primary tracking-tight leading-none">{value}</p>
        <p className="text-xs text-text-secondary mt-1">{label}</p>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const kpis = useAdminStore((s) => s.kpis)
  const kpisLoading = useAdminStore((s) => s.kpisLoading)
  const fetchKpis = useAdminStore((s) => s.fetchKpis)

  useEffect(() => {
    void fetchKpis()
  }, [fetchKpis])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-text-primary uppercase tracking-wider">Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">Resumen general del sistema</p>
      </div>

      {kpisLoading && !kpis && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total jugadores"
            value={kpis.total_players}
            icon={<Users size={20} />}
          />
          <KpiCard
            label="Jugadores activos"
            value={kpis.active_players}
            icon={<Users size={20} />}
            accent
          />
          <KpiCard
            label="Baneados"
            value={kpis.banned_players}
            icon={<Shield size={20} />}
            danger
          />
          <KpiCard
            label="Moderadores"
            value={kpis.total_moderators}
            icon={<UserCog size={20} />}
          />
          <KpiCard
            label="Total partidos"
            value={kpis.total_matches}
            icon={<Swords size={20} />}
          />
          <KpiCard
            label="Partidos completados"
            value={kpis.completed_matches}
            icon={<Swords size={20} />}
            accent
          />
          <KpiCard
            label="Disputas pendientes"
            value={kpis.pending_disputes}
            icon={<AlertTriangle size={20} />}
            danger={kpis.pending_disputes > 0}
          />
          <KpiCard
            label="ELO promedio"
            value={Math.round(kpis.avg_elo)}
            icon={<TrendingUp size={20} />}
            accent
          />
        </div>
      )}
    </div>
  )
}
