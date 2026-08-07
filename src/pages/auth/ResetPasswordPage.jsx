import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import AuthField from '../../components/AuthField.jsx'
import { resetPassword } from '../../services/auth.service.js'

function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const token = searchParams.get('token')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)

    try {
      const result = await resetPassword(token, form.password)
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
      <p className="mt-2 text-slate-500">Choose a password you haven&apos;t used before.</p>

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
        {!token && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Reset token is missing.
          </p>
        )}
        {message && (
          <p className="rounded-xl bg-primary-light px-4 py-3 text-sm text-primary-dark">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        <button
          disabled={!token || submitting || Boolean(message)}
          className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Resetting...' : 'Reset password'}
        </button>
      </form>

      {message && (
        <Link
          className="mt-7 block text-center text-sm font-semibold text-primary-dark hover:underline"
          to="/login"
        >
          Continue to sign in
        </Link>
      )}
    </div>
  )
}

export default ResetPasswordPage
