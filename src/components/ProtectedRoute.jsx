import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../context/AuthContext.jsx'

function ProtectedRoute() {
  const { user, loading } = useAuth()
  const verificationRequired = import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION === 'true'

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream">
        <div className="size-10 animate-spin rounded-full border-4 border-primary-light border-t-primary" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (verificationRequired && !user.isEmailVerified) {
    return <Navigate to="/check-email" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
