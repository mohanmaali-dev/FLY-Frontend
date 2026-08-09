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
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-2 text-ink-soft">Sign in to continue to your account.</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <AuthField
          label="Email address"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="you@example.com"
          required
        />
        <AuthField
          label="Password"
          type="password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          placeholder="Enter your password"
          required
        />

        <div className="text-right">
          <Link className="text-sm font-semibold text-primary-dark hover:underline" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        {error && <p className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

        <button
          className="w-full rounded-xl bg-accent-strong px-5 py-3 font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-ink-soft">
        Don&apos;t have an account?{' '}
        <Link className="font-semibold text-primary-dark hover:underline" to="/register">
          Create account
        </Link>
      </p>
    </div>
  )
}

export default LoginPage
