import { useEffect, useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 50

export function AdminAuditLogPage() {
  const auditEntries = useAdminStore((s) => s.auditEntries)
  const auditTotal = useAdminStore((s) => s.auditTotal)
  const auditLoading = useAdminStore((s) => s.auditLoading)
  const fetchAuditLog = useAdminStore((s) => s.fetchAuditLog)

  const [adminIdFilter, setAdminIdFilter] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    void fetchAuditLog({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      admin_id: adminIdFilter.trim() || undefined,
    })
  }, [fetchAuditLog, page, adminIdFilter])

  const totalPages = Math.max(1, Math.ceil(auditTotal / PAGE_SIZE))

  function handleFilter() {
    setPage(0)
    void fetchAuditLog({
      limit: PAGE_SIZE,
      offset: 0,
      admin_id: adminIdFilter.trim() || undefined,
    })
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-text-primary uppercase tracking-wider">Audit Log</h1>
        <p className="text-text-secondary text-sm mt-1">{auditTotal} registro{auditTotal !== 1 ? 's' : ''}</p>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-6 max-w-lg">
        <Input
          value={adminIdFilter}
          onChange={(e) => setAdminIdFilter(e.target.value)}
          placeholder="Filtrar por Admin UUID (opcional)"
          containerClassName="flex-1"
          onKeyDown={(e) => { if (e.key === 'Enter') handleFilter() }}
        />
        <Button onClick={handleFilter} variant="secondary">Filtrar</Button>
      </div>

      {auditLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : auditEntries.length === 0 ? (
        <EmptyState icon={<ClipboardList size={40} />} title="Sin registros" subtitle="No hay entradas en el audit log para este filtro" />
      ) : (
        <>
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Accion</th>
                  <th className="text-left px-5 py-3 font-medium">Admin ID</th>
                  <th className="text-left px-5 py-3 font-medium">Target</th>
                  <th className="text-left px-5 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-bg-input transition-colors">
                    <td className="px-5 py-3 text-text-primary font-medium">{entry.action}</td>
                    <td className="px-5 py-3 text-text-secondary font-mono text-xs">{entry.admin_id.slice(0, 8)}...</td>
                    <td className="px-5 py-3 text-text-secondary font-mono text-xs">
                      {entry.target_user_id ? entry.target_user_id.slice(0, 8) + '...' : '—'}
                    </td>
                    <td className="px-5 py-3 text-text-secondary text-xs">
                      {new Date(entry.created_at).toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-3 justify-between">
            <p className="text-text-secondary text-xs">
              Pagina {page + 1} de {totalPages} · {auditTotal} registros
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="min-h-11 min-w-11 flex items-center justify-center rounded-lg bg-bg-input text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="min-h-11 min-w-11 flex items-center justify-center rounded-lg bg-bg-input text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
