import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext.jsx'
import { AppHeader } from '../components/AppHeader.jsx'

function HomePage() {
  const { user, loading, logout } = useAuth()

  const statusPill =
    loading || !user ? null : (
      <span className="flex items-center gap-2 rounded-md bg-primary-50 px-2.5 py-1.5 text-[11px] font-medium text-primary-dark ring-1 ring-primary-100 sm:px-3 sm:text-xs">
        <span className="status-dot bg-primary" />
        <span className="hidden sm:inline">Signed in</span>
        <span className="sm:hidden">In</span>
      </span>
    )

  return (
    <div className="min-h-screen bg-ink-50 text-ink-800">
      <AppHeader statusNode={statusPill} user={user} onLogout={logout} />

      <main className="mx-auto flex max-w-5xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">
          Welcome to FLY Bridge
        </p>
        <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-ink-900 sm:text-5xl">
          Send text, links, and files across devices instantly
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-7 text-ink-500 sm:text-lg sm:leading-8">
          Pair a second device to move content — no cloud accounts, no email, no sign-up required.
          Private, simple, and reliable.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          {loading
            ? null
            : user
              ? (
                  <Link
                    to="/dashboard"
                    className="rounded-md bg-primary px-6 py-3 text-[14px] font-medium text-white shadow-sm transition hover:bg-primary-600 active:translate-y-px"
                  >
                    Open dashboard
                  </Link>
                )
              : (
                  <>
                    <Link
                      to="/register"
                      className="rounded-md bg-primary px-6 py-3 text-[14px] font-medium text-white shadow-sm transition hover:bg-primary-600 active:translate-y-px"
                    >
                      Get started
                    </Link>
                    <Link
                      to="/login"
                      className="rounded-md border border-border bg-white px-6 py-3 text-[14px] font-medium text-ink-700 transition hover:bg-ink-50"
                    >
                      Sign in
                    </Link>
                  </>
                )}
        </div>
      </main>
    </div>
  )
}

export default HomePage
