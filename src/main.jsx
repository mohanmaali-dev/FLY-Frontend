import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SupabaseSetupNotice from './components/SupabaseSetupNotice.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { DeviceProvider } from './context/DeviceContext.jsx'
import { isSupabaseConfigured } from './services/supabase.js'
import { installGlobalMonitoring } from './services/telemetry.service.js'

// Browser chrome and the favicon follow the single colour in theme.css.
const applyBrandToBrowser = () => {
  const brand = getComputedStyle(document.documentElement)
    .getPropertyValue('--fly-brand')
    .trim()

  if (!brand) return
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', brand)

  const favicon = document.querySelector('link[rel="icon"]')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" rx="8" fill="${brand}"/><path d="M9 8v16M9 8h12M9 16h11m-4-4 4 4-4 4" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  favicon?.setAttribute('href', `data:image/svg+xml,${encodeURIComponent(svg)}`)
}

applyBrandToBrowser()
installGlobalMonitoring()

// Mounting the app without credentials would blow up inside the Supabase
// client and leave a blank page, so check before rendering anything that
// touches it.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
    {isSupabaseConfigured ? (
      // ToastProvider wraps DeviceProvider: the device layer raises the
      // "other device left" notification.
      <ToastProvider>
        <DeviceProvider>
          <App />
        </DeviceProvider>
      </ToastProvider>
    ) : (
      <SupabaseSetupNotice />
    )}
    </AppErrorBoundary>
  </StrictMode>,
)
