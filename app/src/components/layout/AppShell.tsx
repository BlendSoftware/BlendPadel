import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { ToastContainer } from './Toast'
import { OfflineBanner } from './OfflineBanner'

export function AppShell() {
  return (
    <div className="min-h-dvh bg-bg-dark text-text-primary">
      {/* Global toast overlay — rendered above everything */}
      <ToastContainer />

      <div className="mx-auto max-w-[480px] min-h-dvh flex flex-col relative">
        {/* Offline indicator — sticky at top of the app column */}
        <OfflineBanner />

        {/* Scrollable content area — padded bottom to clear the fixed nav */}
        <main className="flex-1 overflow-y-auto pb-16">
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </div>
  )
}
