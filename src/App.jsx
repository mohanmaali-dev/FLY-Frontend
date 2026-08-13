import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import AuthLayout from './components/AuthLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage.jsx'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage.jsx'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage.jsx'))
const PairingPage = lazy(() => import('./pages/PairingPage.jsx'))
const JoinPairingPage = lazy(() => import('./pages/JoinPairingPage.jsx'))
const NotesPage = lazy(() => import('./pages/NotesPage.jsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))

function RouteMetadata() {
  const { pathname } = useLocation()

  const home = pathname === '/'
  const title = home
    ? 'FLY — Cross-device sharing'
    : pathname.startsWith('/pair/')
      ? 'Join a sharing session — FLY'
      : pathname === '/notes'
        ? 'My notes — FLY'
        : pathname === '/login'
          ? 'Log in — FLY'
          : pathname === '/register'
            ? 'Create an account — FLY'
            : 'FLY'

  useEffect(() => {
    document.title = title
    const robots = document.querySelector('meta[name="robots"]')
    robots?.setAttribute('content', home ? 'index, follow' : 'noindex, nofollow')
  }, [home, title])

  return null
}

function PageFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-raised text-ink">
      <div role="status" className="text-center">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
        <p className="mt-3 text-sm font-medium text-ink-soft">Loading FLY...</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <RouteMetadata />
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
          {/* The QR is the landing page — no sign-in, no marketing detour. */}
          <Route path="/" element={<PairingPage />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          {/* /pair/:sessionId — secondary device joins via QR or shared link */}
          <Route path="/pair/:sessionId" element={<JoinPairingPage />} />
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/notes" element={<NotesPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
