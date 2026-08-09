import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import AuthLayout from './components/AuthLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx'
import PairingPage from './pages/PairingPage.jsx'
import JoinPairingPage from './pages/JoinPairingPage.jsx'
import NotesPage from './pages/NotesPage.jsx'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
