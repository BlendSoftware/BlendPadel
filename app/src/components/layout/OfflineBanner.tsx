import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Sin conexión a internet"
      className="sticky top-0 z-50 flex items-center justify-center gap-2
                 bg-trust-low/90 px-4 py-2.5 text-white text-sm font-medium
                 backdrop-blur-sm animate-[slideDown_200ms_ease-out]"
    >
      <WifiOff size={15} aria-hidden="true" />
      <span>Sin conexión — modo offline</span>
    </div>
  )
}
