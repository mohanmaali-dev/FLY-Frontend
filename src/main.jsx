import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SupabaseSetupNotice from './components/SupabaseSetupNotice.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { DeviceProvider } from './context/DeviceContext.jsx'
import { isSupabaseConfigured } from './services/supabase.js'

// Mounting the app without credentials would blow up inside the Supabase
// client and leave a blank page, so check before rendering anything that
// touches it.
createRoot(document.getElementById('root')).render(
  <StrictMode>
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
  </StrictMode>,
)
