import { useEffect, useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import { useRankingsStore } from '@/stores/rankings-store'
import type { ModeratorResponse, CreateModeratorRequest } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { UserCog, Trash2, Pencil, Plus, X } from 'lucide-react'

// ─── Modal ────────────────────────────────────────────────────────────────────

type Mode = 'promote' | 'create'

interface ModalProps {
  editing: ModeratorResponse | null
  onClose: () => void
  regions: { id: string; name: string }[]
}

function ModeratorModal({ editing, onClose, regions }: ModalProps) {
  const createModerator = useAdminStore((s) => s.createModerator)
  const updateModerator = useAdminStore((s) => s.updateModerator)
  const actionLoading = useAdminStore((s) => s.actionLoading)

  const [mode, setMode] = useState<Mode>('promote')
  const [form, setForm] = useState<Partial<CreateModeratorRequest>>({
    region_id: editing?.region_id ?? '',
    user_id: '',
    email: '',
    password: '',
    name: editing?.name ?? '',
    last_name: editing?.last_name ?? '',
  })

  function set(field: keyof CreateModeratorRequest, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editing) {
        await updateModerator(editing.id, form as CreateModeratorRequest)
        window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'success', message: 'Moderador actualizado' } }))
      } else {
        await createModerator(form as CreateModeratorRequest)
        window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'success', message: 'Moderador creado' } }))
      }
      onClose()
    } catch {
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'error', message: 'No se pudo guardar el moderador' } }))
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-bg-card border border-border rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-xl text-text-primary uppercase tracking-wider">
            {editing ? 'Editar moderador' : 'Nuevo moderador'}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary min-h-11 min-w-11 flex items-center justify-center rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {!editing && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('promote')}
                className={[
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-11 border',
                  mode === 'promote'
                    ? 'bg-padel-green/10 text-padel-green border-padel-green/30'
                    : 'bg-bg-input text-text-secondary border-border hover:border-border/50',
                ].join(' ')}
              >
                Promover existente
              </button>
              <button
                type="button"
                onClick={() => setMode('create')}
                className={[
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-11 border',
                  mode === 'create'
                    ? 'bg-padel-green/10 text-padel-green border-padel-green/30'
                    : 'bg-bg-input text-text-secondary border-border hover:border-border/50',
                ].join(' ')}
              >
                Crear nuevo
              </button>
            </div>
          )}

          {!editing && mode === 'promote' && (
            <Input
              label="UUID del jugador a promover"
              value={form.user_id ?? ''}
              onChange={(e) => set('user_id', e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
            />
          )}

          {(!editing && mode === 'create') && (
            <>
              <Input
                label="Email"
                type="email"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
                required
              />
              <Input
                label="Contraseña"
                type="password"
                value={form.password ?? ''}
                onChange={(e) => set('password', e.target.value)}
                required
              />
            </>
          )}

          <Input
            label="Nombre"
            value={form.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            required={!editing || mode === 'create'}
          />
          <Input
            label="Apellido (opcional)"
            value={form.last_name ?? ''}
            onChange={(e) => set('last_name', e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Region</label>
            <select
              value={form.region_id ?? ''}
              onChange={(e) => set('region_id', e.target.value)}
              required
              className="w-full rounded-xl bg-bg-input text-text-primary border border-border min-h-11 px-4 py-2.5 text-sm focus:outline-none focus:border-padel-green"
            >
              <option value="">Seleccionar region</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} type="button" fullWidth>
              Cancelar
            </Button>
            <Button type="submit" loading={actionLoading} fullWidth>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AdminModeratorsPage() {
  const moderators = useAdminStore((s) => s.moderators)
  const moderatorsLoading = useAdminStore((s) => s.moderatorsLoading)
  const actionLoading = useAdminStore((s) => s.actionLoading)
  const fetchModerators = useAdminStore((s) => s.fetchModerators)
  const deleteModerator = useAdminStore((s) => s.deleteModerator)

  const regions = useRankingsStore((s) => s.regions)
  const fetchRegions = useRankingsStore((s) => s.fetchRegions)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ModeratorResponse | null>(null)

  useEffect(() => {
    void fetchModerators()
    void fetchRegions()
  }, [fetchModerators, fetchRegions])

  async function handleDelete(id: string) {
    if (!confirm('Eliminar moderador?')) return
    try {
      await deleteModerator(id)
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'success', message: 'Moderador eliminado' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'error', message: 'No se pudo eliminar' } }))
    }
  }

  function openEdit(m: ModeratorResponse) {
    setEditing(m)
    setModalOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-text-primary uppercase tracking-wider">Moderadores</h1>
          <p className="text-text-secondary text-sm mt-1">{moderators.length} moderador{moderators.length !== 1 ? 'es' : ''}</p>
        </div>
        <Button onClick={openCreate} size="md">
          <Plus size={16} />
          Nuevo
        </Button>
      </div>

      {moderatorsLoading && moderators.length === 0 ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : moderators.length === 0 ? (
        <EmptyState
          icon={<UserCog size={40} />}
          title="Sin moderadores"
          subtitle="Crea el primer moderador usando el boton de arriba"
        />
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Nombre</th>
                <th className="text-left px-5 py-3 font-medium">Email</th>
                <th className="text-left px-5 py-3 font-medium">Estado</th>
                <th className="text-left px-5 py-3 font-medium">Region</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {moderators.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-bg-input transition-colors">
                  <td className="px-5 py-3 text-text-primary font-medium">
                    {[m.name, m.last_name].filter(Boolean).join(' ')}
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{m.email}</td>
                  <td className="px-5 py-3">
                    <Badge variant={m.status === 'active' ? 'green' : 'gray'}>{m.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-text-secondary text-xs font-mono">
                    {m.region_id ? m.region_id.slice(0, 8) + '...' : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(m)}
                        className="text-text-secondary hover:text-text-primary min-h-11 min-w-11 flex items-center justify-center rounded-lg transition-colors"
                        aria-label="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={actionLoading}
                        className="text-trust-low hover:text-red-400 min-h-11 min-w-11 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <ModeratorModal
          editing={editing}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          regions={regions}
        />
      )}
    </div>
  )
}
