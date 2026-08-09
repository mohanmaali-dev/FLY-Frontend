import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import AuthField from '../../components/AuthField.jsx'
import {
  getSession,
  onAuthStateChange,
  resetPassword,
} from '../../services/auth.service.js'

function ResetPasswordPage() {
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Supabase's recovery link signs the user in before redirecting here, so
  // instead of reading a ?token= we wait for that session to materialise.
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true

    const { data: subscription } = onAuthStateChange((_event, session) => {
      if (!active || !session) return
      setReady(true)
      setChecking(false)
    })

    // The tokens arrive in the URL fragment and are consumed asynchronously,
    // so a session may already exist by the time this runs — or arrive just
    // after. Cover both, and stop waiting after a short grace period.
    getSession().then((session) => {
      if (!active) return
      if (session) {
        setReady(true)
        setChecking(false)
      }
    })

    const timer = setTimeout(() => {
      if (active) setChecking(false)
    }, 3000)

    return () => {
      active = false
      clearTimeout(timer)
      subscription?.subscription?.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)

    try {
      const result = await resetPassword(form.password)
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Set a new password</h1>
      <p className="mt-2 text-ink-soft">Choose a password you haven&apos;t used before.</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <AuthField
          label="New password"
          type="password"
          minLength="8"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          placeholder="Minimum 8 characters"
          required
        />
        <AuthField
          label="Confirm password"
          type="password"
          minLength="8"
          value={form.confirmPassword}
          onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
          placeholder="Enter the password again"
          required
        />
        {!checking && !ready && (
          <p className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
            This reset link is invalid or has expired. Request a new one.
          </p>
        )}
        {message && (
          <p className="rounded-xl border border-accent-line bg-accent-soft px-4 py-3 text-sm text-accent-hover">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
        )}
        <button
          disabled={!ready || submitting || Boolean(message)}
          className="w-full rounded-xl bg-accent-strong px-5 py-3 font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? 'Checking link...' : submitting ? 'Resetting...' : 'Reset password'}
        </button>
      </form>

      {(message || (!checking && !ready)) && (
        <Link
          className="mt-7 block text-center text-sm font-semibold text-primary-dark hover:underline"
          to={message ? '/login' : '/forgot-password'}
        >
          {message ? 'Continue to sign in' : 'Request a new link'}
        </Link>
      )}
    </div>
  )
}

export default ResetPasswordPage
