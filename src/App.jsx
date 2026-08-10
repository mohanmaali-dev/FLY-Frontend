import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AuthLayout from './components/AuthLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import CheckEmailPage from './pages/auth/CheckEmailPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx'
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import HomePage from './pages/HomePage.jsx'
import JoinPairingPage from './pages/JoinPairingPage.jsx'
import NotesPage from './pages/NotesPage.jsx'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          {/* /pair/:sessionId — secondary device joins via QR or shared link */}
          <Route path="/pair/:sessionId" element={<JoinPairingPage />} />
          <Route path="/check-email" element={<CheckEmailPage />} />
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/notes" element={<NotesPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
