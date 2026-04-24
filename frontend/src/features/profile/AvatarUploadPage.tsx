import { useState, useRef } from 'react'
import { ArrowLeft, Camera, Upload, X, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/stores/profile-store'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar } from '@/components/ui/Avatar'
import styles from './SubPage.module.css'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function AvatarUploadPage() {
  const navigate     = useNavigate()
  const profile      = useProfileStore((s) => s.profile)
  const uploading    = useProfileStore((s) => s.uploading)
  const profileError = useProfileStore((s) => s.error)
  const uploadAvatar = useProfileStore((s) => s.uploadAvatar)
  const user         = useAuthStore((s) => s.user)

  const fileInputRef   = useRef<HTMLInputElement>(null)
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validError,   setValidError]   = useState<string | null>(null)
  const [uploadError,  setUploadError]  = useState<string | null>(null)

  const displayName      = profile ? `${profile.name} ${profile.last_name}`.trim() : (user?.name ?? '')
  const currentAvatarUrl = profile?.avatar_url ?? user?.avatar_url ?? null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setValidError(null)
    setUploadError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setValidError('Formato no soportado. Usá JPEG, PNG o WebP.')
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidError('La imagen es demasiado grande. El máximo es 5 MB.')
      return
    }
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handleClear() {
    setSelectedFile(null)
    setPreviewUrl(null)
    setValidError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploadError(null)
    try {
      await uploadAvatar(selectedFile)
      navigate(-1)
    } catch {
      setUploadError(profileError ?? 'No se pudo subir la imagen. Intentá de nuevo.')
    }
  }

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Volver">
          <ArrowLeft size={18} />
        </button>
        <h1 className={styles.headerTitle}>Foto de perfil</h1>
      </div>

      <div className={styles.body}>
        {/* ── Avatar preview card ── */}
        <div className={styles.card} style={{ alignItems: 'center', gap: 20, padding: '32px 20px' }}>
          {/* Preview / current avatar */}
          <div className={styles.avatarPreviewWrap}>
            {previewUrl ? (
              <>
                <img
                  src={previewUrl}
                  alt="Vista previa"
                  className={styles.avatarPreview}
                />
                <button
                  className={styles.avatarClearBtn}
                  onClick={handleClear}
                  aria-label="Quitar imagen seleccionada"
                  type="button"
                >
                  <X size={13} />
                </button>
              </>
            ) : (
              <Avatar src={currentAvatarUrl} name={displayName} size="xl" />
            )}
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p className={styles.avatarLabel}>
              {previewUrl
                ? 'Vista previa — confirmá para subir'
                : currentAvatarUrl
                  ? 'Foto actual'
                  : 'Sin foto de perfil'}
            </p>
            <p className={styles.avatarHint}>JPEG · PNG · WebP · Máx 5 MB</p>
          </div>
        </div>

        {/* ── Errores ── */}
        {(validError || uploadError) && (
          <div className={styles.errorAlert} role="alert">
            <AlertCircle size={16} className={styles.errorIcon} />
            <p className={styles.errorText}>{validError ?? uploadError}</p>
          </div>
        )}

        {/* ── File picker ── */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileChange}
          className="sr-only"
          id="avatar-file-input"
          aria-label="Seleccionar imagen"
        />

        <label htmlFor="avatar-file-input" className={styles.filePickerLabel}>
          <Camera size={17} />
          {selectedFile ? 'Elegir otra imagen' : 'Seleccionar imagen'}
        </label>

        {/* ── Upload confirm (solo si hay archivo) ── */}
        {selectedFile && (
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading
              ? <><span className={styles.btnSpinner} /> Subiendo…</>
              : <><Upload size={16} /> Subir foto</>
            }
          </button>
        )}
      </div>
    </div>
  )
}
