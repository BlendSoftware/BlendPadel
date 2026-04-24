import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenueStore } from '@/stores/venue-store'
import { Header } from '@/components/layout/Header'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function CreateVenuePage() {
  const navigate = useNavigate()
  const isLoading = useVenueStore((s) => s.isLoading)
  const error = useVenueStore((s) => s.error)
  const createVenue = useVenueStore((s) => s.createVenue)
  const clearError = useVenueStore((s) => s.clearError)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [courtCount, setCourtCount] = useState('1')
  const [phone, setPhone] = useState('')
  const [locationLoaded, setLocationLoaded] = useState(false)

  // Pre-fill lat/lng from geolocation
  useEffect(() => {
    clearError()
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude.toFixed(6))
          setLng(pos.coords.longitude.toFixed(6))
          setLocationLoaded(true)
        },
        () => {
          setLocationLoaded(true)
        },
      )
    } else {
      setLocationLoaded(true)
    }
  }, [clearError])

  const canSubmit = name.trim() && address.trim() && lat && lng && !isLoading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    try {
      await createVenue({
        name: name.trim(),
        address: address.trim(),
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        court_count: parseInt(courtCount, 10) || 1,
        phone: phone.trim() || undefined,
      })
      navigate('/venues', { replace: true })
    } catch {
      // Error is already set in the store
    }
  }

  return (
    <div className="flex flex-col min-h-full page-enter">
      <Header title="Sugerir cancha" showBack />

      <form onSubmit={handleSubmit} className="px-4 pt-6 pb-6 space-y-4">
        <Input
          label="Nombre *"
          placeholder="Ej: Club Rivadavia"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <Input
          label="Dirección *"
          placeholder="Ej: San Martín 450, Rivadavia"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Latitud"
            type="number"
            step="any"
            placeholder="-33.1234"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            hint={locationLoaded ? 'Auto-detectada' : 'Obteniendo...'}
          />
          <Input
            label="Longitud"
            type="number"
            step="any"
            placeholder="-68.4567"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
          />
        </div>

        <Input
          label="Cantidad de canchas"
          type="number"
          min="1"
          max="50"
          value={courtCount}
          onChange={(e) => setCourtCount(e.target.value)}
        />

        <Input
          label="Teléfono (opcional)"
          type="tel"
          placeholder="Ej: 261-4001234"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        {error && (
          <p className="text-xs text-trust-low" role="alert">{error}</p>
        )}

        <div className="pt-2">
          <Button
            type="submit"
            fullWidth
            loading={isLoading}
            disabled={!canSubmit}
          >
            Enviar sugerencia
          </Button>
        </div>
      </form>
    </div>
  )
}
