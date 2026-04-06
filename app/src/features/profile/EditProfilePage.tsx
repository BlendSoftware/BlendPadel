import { useState, useEffect } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/stores/profile-store'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

// Mendoza province approximate bounds
const MENDOZA_BOUNDS = {
  latMin: -35.5,
  latMax: -32.0,
  lngMin: -70.5,
  lngMax: -67.5,
}

function isWithinMendoza(lat: number, lng: number): boolean {
  return (
    lat >= MENDOZA_BOUNDS.latMin &&
    lat <= MENDOZA_BOUNDS.latMax &&
    lng >= MENDOZA_BOUNDS.lngMin &&
    lng <= MENDOZA_BOUNDS.lngMax
  )
}

export function EditProfilePage() {
  const navigate = useNavigate()

  const profile = useProfileStore((s) => s.profile)
  const loading = useProfileStore((s) => s.loading)
  const updateProfile = useProfileStore((s) => s.updateProfile)
  const fetchProfile = useProfileStore((s) => s.fetchProfile)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Seed form with current profile data
  useEffect(() => {
    if (!profile) {
      fetchProfile()
      return
    }
    setFirstName(profile.name ?? '')
    setLastName(profile.last_name ?? '')
    setLat(profile.latitude ?? null)
    setLng(profile.longitude ?? null)
  }, [profile, fetchProfile])

  function handleGetLocation() {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no soporta geolocalización.')
      return
    }

    setGeoLoading(true)
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        if (!isWithinMendoza(latitude, longitude)) {
          setGeoError(
            'Tu ubicación está fuera de Mendoza. Verificá que el GPS esté activado correctamente.',
          )
          setGeoLoading(false)
          return
        }
        setLat(parseFloat(latitude.toFixed(6)))
        setLng(parseFloat(longitude.toFixed(6)))
        setGeoLoading(false)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Permiso de ubicación denegado. Habilitalo en la configuración del navegador.')
        } else {
          setGeoError('No se pudo obtener tu ubicación. Intentá de nuevo.')
        }
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    // BUG 14 FIX: Include name field in update payload
    const data: { name?: string; last_name?: string; latitude?: number; longitude?: number } = {}
    if (firstName.trim()) data.name = firstName.trim()
    if (lastName.trim()) data.last_name = lastName.trim()
    if (lat !== null) data.latitude = lat
    if (lng !== null) data.longitude = lng

    try {
      await updateProfile(data)
      navigate(-1)
    } catch {
      setSubmitError('No se pudo guardar los cambios. Intentá de nuevo.')
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Editar perfil" showBack />

      <form onSubmit={handleSubmit} className="px-4 pt-6 pb-6 space-y-4">
        {/* Name fields — BUG 14 FIX: Added nombre field */}
        <Card>
          <div className="space-y-4">
            <Input
              label="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Tu nombre"
              autoComplete="given-name"
            />
            <Input
              label="Apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Tu apellido"
              autoComplete="family-name"
            />
          </div>
        </Card>

        {/* Location */}
        <Card>
          <p className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <MapPin size={16} className="text-padel-green" aria-hidden="true" />
            Ubicación
          </p>

          {lat !== null && lng !== null ? (
            <div className="flex items-center gap-2 mb-3 p-3 bg-bg-input rounded-xl">
              <MapPin size={14} className="text-padel-green shrink-0" aria-hidden="true" />
              <div>
                <p className="text-text-primary text-sm font-medium">Ubicación guardada</p>
                <p className="text-text-secondary text-xs">
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-text-secondary text-sm mb-3">Sin ubicación guardada</p>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleGetLocation}
            loading={geoLoading}
            fullWidth
          >
            <Navigation size={16} aria-hidden="true" />
            {lat !== null ? 'Actualizar mi ubicación' : 'Usar mi ubicación'}
          </Button>

          {geoError && (
            <p className="text-trust-low text-xs mt-2" role="alert">
              {geoError}
            </p>
          )}
        </Card>

        {/* Submit error */}
        {submitError && (
          <p className="text-trust-low text-sm text-center" role="alert">
            {submitError}
          </p>
        )}

        {/* Submit */}
        <Button type="submit" fullWidth loading={loading}>
          Guardar cambios
        </Button>
      </form>
    </div>
  )
}
