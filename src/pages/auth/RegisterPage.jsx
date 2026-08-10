import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AuthField from '../../components/AuthField.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await register(form)
      navigate(result.meta?.requiresEmailVerification ? '/check-email' : '/dashboard')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p className="mt-2 text-ink-500">Get started with your new workspace.</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <AuthField label="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" required />
        <AuthField label="Email address" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" required />
        <AuthField label="Password" type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Minimum 8 characters" required />

        {error && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm text-primary-dark">{error}</p>}

        <button className="w-full rounded-md bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary-600 disabled:opacity-60" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-ink-500">
        Already have an account?{' '}
        <Link className="font-semibold text-primary-dark hover:underline" to="/login">Sign in</Link>
      </p>
    </div>
  )
}

export default RegisterPage
