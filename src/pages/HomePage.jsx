import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext.jsx'

function HomePage() {
  const { user, loading, logout } = useAuth()

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-primary/15 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link to="/" className="text-xl font-bold text-primary-dark">
            TEST
          </Link>

          {loading ? null : user ? (
            <button
              onClick={logout}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-light"
            >
              Log out
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-semibold text-primary-dark hover:underline"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                Register
              </Link>
            </div>
          )}
        </nav>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center sm:py-32">
        <p className="font-semibold text-primary">WELCOME TO TEST</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          A simple full-stack application
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Register an account, verify your email, sign in, and explore the working dashboard.
        </p>

        <div className="mt-9 flex gap-3">
          {loading ? null : user ? (
            <Link
              to="/dashboard"
              className="rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-dark"
            >
              Go  dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-dark"
              >
                Get started
              </Link>
              <Link
                to="/login"
                className="rounded-lg border border-primary/30 bg-white px-6 py-3 font-semibold text-primary-dark hover:bg-primary-light"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </main>

      {/* <footer className="border-t border-primary/15 py-6 text-center text-sm text-slate-500">
        © 2026 TEST
      </footer> */}
    </div>
  )
}

export default HomePage
