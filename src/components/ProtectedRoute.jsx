import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../context/AuthContext.jsx'

function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream">
        <div className="size-10 animate-spin rounded-full border-4 border-primary-light border-t-primary" />
      </div>
    )
  }

  // Signing in is all that is required — there is no email confirmation step.
  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}

export default ProtectedRoute
