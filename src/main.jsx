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
