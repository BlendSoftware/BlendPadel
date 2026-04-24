import { useEffect, useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import type { DisputeResponse, ResolveDisputeRequest } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Scale, X } from 'lucide-react'

// ─── Resolve Modal ────────────────────────────────────────────────────────────

interface ResolveModalProps {
  dispute: DisputeResponse
  onClose: () => void
}

function ResolveModal({ dispute, onClose }: ResolveModalProps) {
  const resolveDispute = useAdminStore((s) => s.resolveDispute)
  const actionLoading = useAdminStore((s) => s.actionLoading)

  const [action, setAction] = useState<'seal' | 'dismiss'>('seal')
  const [penalizeId, setPenalizeId] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data: ResolveDisputeRequest = { action }
    if (penalizeId.trim()) data.penalize_player_id = penalizeId.trim()

    try {
      await resolveDispute(dispute.id, data)
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'success', message: 'Disputa resuelta' } }))
      onClose()
    } catch {
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'error', message: 'No se pudo resolver la disputa' } }))
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-bg-card border border-border rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-xl text-text-primary uppercase tracking-wider">Resolver disputa</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary min-h-11 min-w-11 flex items-center justify-center rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div className="bg-bg-input rounded-lg p-4 text-sm">
            <p className="text-text-secondary text-xs mb-1">Razon del dispute</p>
            <p className="text-text-primary">{dispute.reason}</p>
            <p className="text-text-secondary text-xs mt-2 font-mono">Match: {dispute.match_id.slice(0, 8)}...</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAction('seal')}
              className={[
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-11 border',
                action === 'seal'
                  ? 'bg-padel-green/10 text-padel-green border-padel-green/30'
                  : 'bg-bg-input text-text-secondary border-border',
              ].join(' ')}
            >
              Sellar (seal)
            </button>
            <button
              type="button"
              onClick={() => setAction('dismiss')}
              className={[
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-11 border',
                action === 'dismiss'
                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                  : 'bg-bg-input text-text-secondary border-border',
              ].join(' ')}
            >
              Desestimar (dismiss)
            </button>
          </div>

          <Input
            label="Penalizar jugador (UUID, opcional)"
            value={penalizeId}
            onChange={(e) => setPenalizeId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} type="button" fullWidth>Cancelar</Button>
            <Button type="submit" loading={actionLoading} fullWidth>Confirmar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AdminDisputesPage() {
  const disputes = useAdminStore((s) => s.disputes)
  const disputesLoading = useAdminStore((s) => s.disputesLoading)
  const fetchDisputes = useAdminStore((s) => s.fetchDisputes)

  const [selected, setSelected] = useState<DisputeResponse | null>(null)

  useEffect(() => {
    void fetchDisputes()
  }, [fetchDisputes])

  const pending = disputes.filter((d) => d.status === 'pending')
  const resolved = disputes.filter((d) => d.status === 'resolved')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-text-primary uppercase tracking-wider">Disputas</h1>
        <p className="text-text-secondary text-sm mt-1">
          {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
        </p>
      </div>

      {disputesLoading && disputes.length === 0 ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : disputes.length === 0 ? (
        <EmptyState icon={<Scale size={40} />} title="Sin disputas" subtitle="Cuando haya disputas apareceran aca" />
      ) : (
        <div className="flex flex-col gap-6">
          {pending.length > 0 && (
            <section>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-widest mb-3">Pendientes</p>
              <div className="flex flex-col gap-2">
                {pending.map((d) => (
                  <DisputeRow key={d.id} dispute={d} onResolve={() => setSelected(d)} />
                ))}
              </div>
            </section>
          )}
          {resolved.length > 0 && (
            <section>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-widest mb-3">Resueltas</p>
              <div className="flex flex-col gap-2">
                {resolved.map((d) => (
                  <DisputeRow key={d.id} dispute={d} onResolve={null} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {selected && (
        <ResolveModal dispute={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function DisputeRow({
  dispute,
  onResolve,
}: {
  dispute: DisputeResponse
  onResolve: (() => void) | null
}) {
  return (
    <div className="bg-bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={dispute.status === 'pending' ? 'orange' : 'gray'}>{dispute.status}</Badge>
          <span className="text-text-secondary text-xs font-mono">
            Match: {dispute.match_id.slice(0, 8)}...
          </span>
        </div>
        <p className="text-text-primary text-sm truncate">{dispute.reason}</p>
        <p className="text-text-secondary text-xs mt-1">
          {new Date(dispute.created_at).toLocaleString('es-AR')}
        </p>
      </div>
      {onResolve && (
        <Button size="sm" onClick={onResolve}>
          Resolver
        </Button>
      )}
    </div>
  )
}
