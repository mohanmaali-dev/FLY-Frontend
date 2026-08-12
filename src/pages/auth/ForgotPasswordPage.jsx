import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import AuthField from '../../components/AuthField.jsx'
import { forgotPassword } from '../../services/auth.service.js'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!cooldown) return

    const timer = setInterval(() => {
      setCooldown((seconds) => seconds - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [cooldown])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting || cooldown) return

    setError('')
    setSubmitting(true)

    try {
      const result = await forgotPassword(email)
      setMessage(result.message)
      setCooldown(60)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <p className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.15em] text-accent-hover">Account recovery</p>
      <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:mt-2 sm:text-4xl">Forgot password?</h1>
      <p className="mt-3 hidden text-sm leading-relaxed text-ink-soft sm:block">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form className="mt-5 space-y-3.5 sm:mt-8 sm:space-y-5" onSubmit={handleSubmit}>
        <AuthField
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        {message && (
          <p role="status" className="rounded-xl border border-ok-line bg-ok-soft px-4 py-3 text-sm text-ok">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
        )}
        <button
          disabled={submitting || cooldown > 0}
          className="w-full rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-button)] transition active:scale-[0.99] hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-mute disabled:shadow-none sm:py-3"
        >
          {submitting
            ? 'Sending...'
            : cooldown
              ? `Send again in ${cooldown}s`
              : 'Send reset link'}
        </button>
      </form>

      <Link
        className="mt-5 block text-center text-sm font-semibold text-accent-hover transition hover:text-ink sm:mt-7"
        to="/login"
      >
        Back to sign in
      </Link>
    </div>
  )
}

export default ForgotPasswordPage
