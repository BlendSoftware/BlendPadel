import { useEffect, useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import { useRankingsStore } from '@/stores/rankings-store'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileWarning } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'reviewed', label: 'Revisados' },
  { value: 'dismissed', label: 'Desestimados' },
]

export function AdminReportsPage() {
  const reports = useAdminStore((s) => s.reports)
  const reportsTotal = useAdminStore((s) => s.reportsTotal)
  const reportsLoading = useAdminStore((s) => s.reportsLoading)
  const fetchReports = useAdminStore((s) => s.fetchReports)

  const regions = useRankingsStore((s) => s.regions)
  const fetchRegions = useRankingsStore((s) => s.fetchRegions)

  const [regionFilter, setRegionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    void fetchRegions()
  }, [fetchRegions])

  useEffect(() => {
    void fetchReports({
      region_id: regionFilter || undefined,
      status: statusFilter || undefined,
    })
  }, [fetchReports, regionFilter, statusFilter])

  function statusVariant(status: string): 'orange' | 'green' | 'gray' {
    if (status === 'pending') return 'orange'
    if (status === 'reviewed') return 'green'
    return 'gray'
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-text-primary uppercase tracking-wider">Reportes</h1>
        <p className="text-text-secondary text-sm mt-1">{reportsTotal} reporte{reportsTotal !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="rounded-xl bg-bg-input text-text-primary border border-border min-h-11 px-4 py-2 text-sm focus:outline-none focus:border-padel-green"
        >
          <option value="">Todas las regiones</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={[
                'px-3 py-2 rounded-lg text-sm transition-colors min-h-11 border',
                statusFilter === opt.value
                  ? 'bg-padel-green/10 text-padel-green border-padel-green/30'
                  : 'bg-bg-input text-text-secondary border-border hover:border-border/60',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {reportsLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : reports.length === 0 ? (
        <EmptyState icon={<FileWarning size={40} />} title="Sin reportes" subtitle="No hay reportes para los filtros seleccionados" />
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Estado</th>
                <th className="text-left px-5 py-3 font-medium">Razon</th>
                <th className="text-left px-5 py-3 font-medium">Match ID</th>
                <th className="text-left px-5 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-bg-input transition-colors">
                  <td className="px-5 py-3">
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-text-primary max-w-xs truncate">{r.reason}</td>
                  <td className="px-5 py-3 text-text-secondary font-mono text-xs">{r.match_id.slice(0, 8)}...</td>
                  <td className="px-5 py-3 text-text-secondary text-xs">
                    {new Date(r.created_at).toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
