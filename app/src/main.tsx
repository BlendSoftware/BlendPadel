import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './routes/router'
import { useAuthStore } from './stores/auth-store'
import { useToastStore } from './stores/toast-store'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { ToastType } from './stores/toast-store'

// Initialize auth on app boot (attempt token refresh from localStorage)
useAuthStore.getState().initialize()

// Bridge custom events from API interceptor → toast store (avoids circular imports)
window.addEventListener('toast:add', (e) => {
  const { type, message } = (e as CustomEvent<{ type: ToastType; message: string }>).detail
  useToastStore.getState().addToast({ type, message })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
)
