import { useState } from 'react'
import { Link } from 'react-router-dom'

import { sendVerificationEmail } from '../../services/auth.service.js'

function CheckEmailPage() {
  const [message, setMessage] = useState('We sent a verification link to your email address.')

  const resendEmail = async () => {
    try {
      const result = await sendVerificationEmail()
      setMessage(result.message)
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-cream px-6">
      <section className="w-full max-w-lg rounded-3xl border border-primary/15 bg-white p-8 text-center shadow-xl shadow-primary/10 sm:p-12">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary-light text-2xl text-primary-dark">
          ✉
        </div>
        <h1 className="mt-6 text-3xl font-bold">Check your email</h1>
        <p className="mt-3 leading-7 text-slate-500">{message}</p>
        <button
          onClick={resendEmail}
          className="mt-8 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary-dark"
        >
          Resend verification email
        </button>
        <Link
          to="/login"
          className="mt-5 block text-sm font-semibold text-primary-dark hover:underline"
        >
          Back to sign in
        </Link>
      </section>
    </main>
  )
}

export default CheckEmailPage
