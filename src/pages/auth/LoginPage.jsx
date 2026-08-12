import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AuthField from '../../components/AuthField.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(form)
      navigate('/')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <p className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.15em] text-accent-hover">Welcome back</p>
      <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:mt-2 sm:text-4xl">Sign in to FLY</h1>
      <p className="mt-3 hidden text-sm leading-relaxed text-ink-soft sm:block">Access your account and continue where you left off.</p>

      <form className="mt-5 space-y-3.5 sm:mt-8 sm:space-y-5" onSubmit={handleSubmit}>
        <AuthField
          label="Email address"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <AuthField
          label="Password"
          type="password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        <div className="text-right">
          <Link className="text-sm font-medium text-accent-hover transition hover:text-ink" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        {error && <p role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

        <button
          className="w-full rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-button)] transition active:scale-[0.99] hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-mute disabled:shadow-none sm:py-3"
          disabled={submitting}
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-soft sm:mt-7">
        Don&apos;t have an account?{' '}
        <Link className="font-semibold text-accent-hover transition hover:text-ink" to="/register">
          Create account
        </Link>
      </p>
    </div>
  )
}

export default LoginPage
