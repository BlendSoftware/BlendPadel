import { useState, useRef } from 'react'
import { Camera, Upload, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/stores/profile-store'
import { useAuthStore } from '@/stores/auth-store'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function AvatarUploadPage() {
  const navigate = useNavigate()

  const profile = useProfileStore((s) => s.profile)
  const uploading = useProfileStore((s) => s.uploading)
  const uploadAvatar = useProfileStore((s) => s.uploadAvatar)

  const user = useAuthStore((s) => s.user)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const displayName = profile
    ? `${profile.name} ${profile.last_name}`.trim()
    : user?.name ?? ''

  const currentAvatarUrl = profile?.avatar_url ?? user?.avatar_url ?? null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setValidationError(null)
    setUploadError(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setValidationError('Formato no soportado. Usá JPEG, PNG o WebP.')
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError('La imagen es demasiado grande. El máximo es 5 MB.')
      return
    }

    setSelectedFile(file)

    // Generate preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPreviewUrl(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  function handleClearSelection() {
    setSelectedFile(null)
    setPreviewUrl(null)
    setValidationError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploadError(null)

    try {
      await uploadAvatar(selectedFile)
      navigate(-1)
    } catch {
      setUploadError('No se pudo subir la imagen. Intentá de nuevo.')
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Foto de perfil" showBack />

      <div className="px-4 pt-6 pb-6 flex flex-col items-center gap-6">
        {/* Preview */}
        <div className="relative">
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="Vista previa"
                className="w-32 h-32 rounded-full object-cover border-2 border-padel-green"
              />
              <button
                onClick={handleClearSelection}
                className="absolute -top-1 -right-1 flex items-center justify-center w-7 h-7 bg-trust-low rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust-low"
                aria-label="Quitar imagen seleccionada"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <Avatar src={currentAvatarUrl} name={displayName} size="xl" />
          )}
        </div>

        {/* Current avatar label */}
        {!previewUrl && (
          <p className="text-text-secondary text-sm text-center">
            {currentAvatarUrl ? 'Foto actual' : 'Sin foto de perfil'}
          </p>
        )}

        {/* File picker button */}
        <div className="w-full max-w-xs space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileChange}
            className="sr-only"
            id="avatar-file-input"
            aria-label="Seleccionar imagen"
          />
          <label
            htmlFor="avatar-file-input"
            className={[
              'flex items-center justify-center gap-2 w-full min-h-11 rounded-xl border font-medium text-sm cursor-pointer transition-all duration-150',
              'bg-transparent text-padel-green border-padel-green hover:bg-padel-green/10 active:scale-95',
              'focus-within:ring-2 focus-within:ring-padel-green',
            ].join(' ')}
          >
            <Camera size={16} aria-hidden="true" />
            {selectedFile ? 'Elegir otra imagen' : 'Seleccionar imagen'}
          </label>

          <p className="text-text-secondary text-xs text-center">
            JPEG, PNG o WebP · Máximo 5 MB
          </p>

          {validationError && (
            <p className="text-trust-low text-sm text-center" role="alert">
              {validationError}
            </p>
          )}
          {uploadError && (
            <p className="text-trust-low text-sm text-center" role="alert">
              {uploadError}
            </p>
          )}

          {selectedFile && (
            <Button fullWidth loading={uploading} onClick={handleUpload}>
              <Upload size={16} aria-hidden="true" />
              Subir foto
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
