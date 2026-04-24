import { useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import type { PlayerSearchResult } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Search } from 'lucide-react'

export function AdminPlayerActionsPage() {
  const searchPlayers = useAdminStore((s) => s.searchPlayers)
  const playerSearchResults = useAdminStore((s) => s.playerSearchResults)
  const playerSearchLoading = useAdminStore((s) => s.playerSearchLoading)
  const banPlayer = useAdminStore((s) => s.banPlayer)
  const unbanPlayer = useAdminStore((s) => s.unbanPlayer)
  const adjustElo = useAdminStore((s) => s.adjustElo)
  const actionLoading = useAdminStore((s) => s.actionLoading)

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PlayerSearchResult | null>(null)

  // Ban form
  const [banType, setBanType] = useState<'soft' | 'hard'>('soft')
  const [banReason, setBanReason] = useState('')

  // ELO form
  const [eloDelta, setEloDelta] = useState('')
  const [eloReason, setEloReason] = useState('')

  const [lastAction, setLastAction] = useState<string | null>(null)

  async function handleSearch() {
    if (!query.trim()) return
    setSelected(null)
    setLastAction(null)
    await searchPlayers(query.trim())
  }

  async function handleBan() {
    if (!selected) return
    try {
      await banPlayer(selected.id, { type: banType, reason: banReason || undefined })
      setLastAction(`Jugador ${selected.name} baneado (${banType})`)
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'success', message: `Jugador baneado (${banType})` } }))
    } catch {
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'error', message: 'No se pudo banear al jugador' } }))
    }
  }

  async function handleUnban() {
    if (!selected) return
    try {
      await unbanPlayer(selected.id)
      setLastAction(`Jugador ${selected.name} desbaneado`)
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'success', message: 'Jugador desbaneado' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'error', message: 'No se pudo desbanear' } }))
    }
  }

  async function handleEloAdjust() {
    if (!selected) return
    const delta = parseInt(eloDelta, 10)
    if (isNaN(delta)) {
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'error', message: 'Delta debe ser un numero entero' } }))
      return
    }
    try {
      await adjustElo(selected.id, { delta, reason: eloReason || undefined })
      setLastAction(`ELO ajustado en ${delta > 0 ? '+' : ''}${delta} para ${selected.name}`)
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'success', message: 'ELO ajustado' } }))
      setEloDelta('')
      setEloReason('')
    } catch {
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'error', message: 'No se pudo ajustar el ELO' } }))
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-text-primary uppercase tracking-wider">Acciones de Jugadores</h1>
        <p className="text-text-secondary text-sm mt-1">Busca un jugador y ejecuta acciones admin</p>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6 max-w-lg">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre o email del jugador..."
          icon={<Search size={16} />}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
          containerClassName="flex-1"
        />
        <Button onClick={() => void handleSearch()} loading={playerSearchLoading} size="md">
          Buscar
        </Button>
      </div>

      {/* Results */}
      {playerSearchLoading && (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      )}

      {!playerSearchLoading && playerSearchResults.length > 0 && !selected && (
        <div className="flex flex-col gap-2 mb-6 max-w-lg">
          {playerSearchResults.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="flex items-center gap-3 bg-bg-card border border-border rounded-xl px-4 py-3 hover:border-padel-green/40 transition-colors text-left min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green"
            >
              <Avatar name={p.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-sm font-medium">{p.name}</p>
                <p className="text-text-secondary text-xs">ELO {p.elo}</p>
              </div>
              <Badge variant="gray">{p.gender}</Badge>
            </button>
          ))}
        </div>
      )}

      {/* Selected player panel */}
      {selected && (
        <div className="max-w-2xl flex flex-col gap-4">
          {/* Player header */}
          <div className="bg-bg-card border border-padel-green/30 rounded-xl px-5 py-4 flex items-center gap-4">
            <Avatar name={selected.name} size="md" />
            <div className="flex-1">
              <p className="text-text-primary font-medium">{selected.name}</p>
              <p className="text-text-secondary text-sm">ELO {selected.elo} · {selected.gender}</p>
              <p className="text-text-secondary text-xs font-mono mt-0.5">{selected.id}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-text-secondary hover:text-text-primary text-sm min-h-11 px-3 rounded-lg hover:bg-bg-input transition-colors"
            >
              Cambiar
            </button>
          </div>

          {lastAction && (
            <div className="bg-padel-green/10 border border-padel-green/30 rounded-xl px-4 py-3 text-sm text-padel-green">
              {lastAction}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ban section */}
            <div className="bg-bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
              <p className="text-text-primary font-medium text-sm uppercase tracking-widest">Banear</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setBanType('soft')}
                  className={[
                    'flex-1 py-2 rounded-lg text-sm min-h-11 border transition-colors',
                    banType === 'soft'
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                      : 'bg-bg-input text-text-secondary border-border',
                  ].join(' ')}
                >
                  Soft
                </button>
                <button
                  onClick={() => setBanType('hard')}
                  className={[
                    'flex-1 py-2 rounded-lg text-sm min-h-11 border transition-colors',
                    banType === 'hard'
                      ? 'bg-trust-low/10 text-trust-low border-trust-low/30'
                      : 'bg-bg-input text-text-secondary border-border',
                  ].join(' ')}
                >
                  Hard
                </button>
              </div>
              <Input
                label="Razon (opcional)"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Razon del ban..."
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={() => void handleBan()}
                  loading={actionLoading}
                  fullWidth
                >
                  Banear
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleUnban()}
                  loading={actionLoading}
                  fullWidth
                >
                  Desbanear
                </Button>
              </div>
            </div>

            {/* ELO Adjust section */}
            <div className="bg-bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
              <p className="text-text-primary font-medium text-sm uppercase tracking-widest">Ajustar ELO</p>
              <Input
                label="Delta (puede ser negativo)"
                type="number"
                value={eloDelta}
                onChange={(e) => setEloDelta(e.target.value)}
                placeholder="+50 o -25"
              />
              <Input
                label="Razon (opcional)"
                value={eloReason}
                onChange={(e) => setEloReason(e.target.value)}
                placeholder="Motivo del ajuste..."
              />
              <Button
                onClick={() => void handleEloAdjust()}
                loading={actionLoading}
                fullWidth
              >
                Ajustar ELO
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
