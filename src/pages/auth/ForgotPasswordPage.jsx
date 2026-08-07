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
      <h1 className="text-3xl font-bold">Forgot password?</h1>
      <p className="mt-2 text-slate-500">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <AuthField
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
        {message && (
          <p className="rounded-xl bg-primary-light px-4 py-3 text-sm text-primary-dark">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        <button
          disabled={submitting || cooldown > 0}
          className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? 'Sending...'
            : cooldown
              ? `Send again in ${cooldown}s`
              : 'Send reset link'}
        </button>
      </form>

      <Link
        className="mt-7 block text-center text-sm font-semibold text-primary-dark hover:underline"
        to="/login"
      >
        Back to sign in
      </Link>
    </div>
  )
}

export default ForgotPasswordPage
