import { useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function AdminRegionsPage() {
  const createRegion = useAdminStore((s) => s.createRegion)
  const actionLoading = useAdminStore((s) => s.actionLoading)

  const [name, setName] = useState('')
  const [boundaryWkt, setBoundaryWkt] = useState('')
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const result = await createRegion(name.trim(), boundaryWkt.trim() || undefined)
      setCreated(result)
      setName('')
      setBoundaryWkt('')
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'success', message: `Region "${result.name}" creada` } }))
    } catch {
      window.dispatchEvent(new CustomEvent('toast:add', { detail: { type: 'error', message: 'No se pudo crear la region' } }))
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-text-primary uppercase tracking-wider">Regiones</h1>
        <p className="text-text-secondary text-sm mt-1">Crear nuevas regiones geograficas</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-bg-card border border-border rounded-xl p-6 flex flex-col gap-4 max-w-lg">
        <Input
          label="Nombre de la region"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ej. Rivadavia Sur"
          required
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">
            Boundary WKT (opcional)
          </label>
          <textarea
            value={boundaryWkt}
            onChange={(e) => setBoundaryWkt(e.target.value)}
            placeholder="POLYGON((lng lat, lng lat, ...))"
            rows={4}
            className="w-full rounded-xl bg-bg-input text-text-primary placeholder:text-text-secondary border border-border px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-padel-green resize-none"
          />
          <p className="text-xs text-text-secondary">
            Formato WKT para definir el contorno geografico de la region. Se puede omitir para crear sin limite.
          </p>
        </div>

        <Button type="submit" loading={actionLoading} fullWidth>
          Crear region
        </Button>
      </form>

      {created && (
        <div className="mt-4 max-w-lg bg-padel-green/10 border border-padel-green/30 rounded-xl px-5 py-4">
          <p className="text-padel-green text-sm font-medium">Region creada exitosamente</p>
          <p className="text-text-secondary text-xs font-mono mt-1">{created.id}</p>
          <p className="text-text-primary text-sm mt-1">{created.name}</p>
        </div>
      )}
    </div>
  )
}
