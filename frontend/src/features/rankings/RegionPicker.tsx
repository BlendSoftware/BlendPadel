import { useEffect, useRef } from 'react'
import { MapPin, X, Check } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import type { Region } from '@/types'

interface RegionPickerProps {
  regions: Region[]
  selectedRegionId: string | null
  loading: boolean
  onSelect: (regionId: string) => void
  onClose: () => void
}

export function RegionPicker({ regions, selectedRegionId, loading, onSelect, onClose }: RegionPickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Focus trap: move focus into dialog on mount
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-bg-dark/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Seleccionar región"
        tabIndex={-1}
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[75vh] flex flex-col rounded-t-2xl bg-bg-card border-t border-border outline-none"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-padel-green" aria-hidden="true" />
            <h2 className="text-base font-semibold text-text-primary">Seleccioná tu región</h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center min-h-11 min-w-11 -mr-2 text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-xl"
            aria-label="Cerrar selector de región"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Region list */}
        <div className="overflow-y-auto flex-1 py-2" role="listbox" aria-label="Regiones disponibles">
          {loading ? (
            <div className="py-8">
              <Spinner size="md" />
            </div>
          ) : regions.length === 0 ? (
            <p className="text-center text-text-secondary text-sm py-8">
              No hay regiones disponibles
            </p>
          ) : (
            regions.map((region) => {
              const isSelected = region.id === selectedRegionId
              return (
                <button
                  key={region.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(region.id)
                    onClose()
                  }}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-3.5 min-h-11 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-padel-green',
                    isSelected
                      ? 'bg-padel-green/10 text-padel-green'
                      : 'text-text-primary hover:bg-bg-input',
                  ].join(' ')}
                >
                  <MapPin
                    size={16}
                    className={isSelected ? 'text-padel-green' : 'text-text-secondary'}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-sm font-medium">{region.name}</span>
                  {isSelected && (
                    <Check size={16} className="text-padel-green shrink-0" aria-hidden="true" />
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Safe area bottom */}
        <div className="h-safe-area-inset-bottom pb-4" aria-hidden="true" />
      </div>
    </>
  )
}
