import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

/**
 * Route guard — renders children via <Outlet /> only when an authenticated
 * user is present. While the initial auth check is running, shows a spinner.
 * Unauthenticated users are redirected to /login with the intended
 * destination preserved in location state.
 */
export default function ProtectedRoute() {
  const { currentUser, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-3"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground font-medium">Carregando...</span>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
