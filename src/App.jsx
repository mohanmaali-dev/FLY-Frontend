import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'

const PairingPage = lazy(() => import('./pages/PairingPage.jsx'))
const JoinPairingPage = lazy(() => import('./pages/JoinPairingPage.jsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.jsx'))
const TermsPage = lazy(() => import('./pages/TermsPage.jsx'))
const ContactPage = lazy(() => import('./pages/ContactPage.jsx'))

function RouteMetadata() {
  const { pathname } = useLocation()

  const home = pathname === '/'
  const publicInfoPage = ['/privacy', '/terms', '/contact'].includes(pathname)
  const title = home
    ? 'FLY — Cross-device sharing'
    : pathname.startsWith('/pair/')
      ? 'Join a sharing session — FLY'
      : pathname === '/privacy'
        ? 'Privacy — FLY'
        : pathname === '/terms'
          ? 'Terms — FLY'
          : pathname === '/contact'
            ? 'Support — FLY'
            : 'FLY'

  useEffect(() => {
    document.title = title
    const robots = document.querySelector('meta[name="robots"]')
    robots?.setAttribute('content', home || publicInfoPage ? 'index, follow' : 'noindex, nofollow')
  }, [home, publicInfoPage, title])

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
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* The QR is the landing page — no sign-in, no marketing detour. */}
          <Route path="/" element={<PairingPage />} />
          {/* /pair/:sessionId — secondary device joins via QR or shared link */}
          <Route path="/pair/:sessionId" element={<JoinPairingPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
