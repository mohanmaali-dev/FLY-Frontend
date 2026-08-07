import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext.jsx'
import { getCurrentUser, refreshSession, verifyEmail } from '../../services/auth.service.js'

function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { updateUser } = useAuth()
  const [status, setStatus] = useState('Verifying your email...')
  const [success, setSuccess] = useState(false)
  const token = searchParams.get('token')

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('Verification token is missing.')
        return
      }

      try {
        const result = await verifyEmail(token)
        setStatus(result.message)
        setSuccess(true)

        try {
          await refreshSession()
          const userResult = await getCurrentUser()
          updateUser(userResult.data)
          navigate('/dashboard', { replace: true })
        } catch {
          navigate('/login', { replace: true })
        }
      } catch (error) {
        setStatus(error.message)
      }
    }

    verify()
  }, [navigate, token, updateUser])

  return (
    <div className="text-center">
      <div className={`mx-auto grid size-16 place-items-center rounded-full text-2xl ${success ? 'bg-primary-light text-primary-dark' : 'bg-slate-100 text-slate-500'}`}>
        {success ? '✓' : '✦'}
      </div>
      <h1 className="mt-6 text-3xl font-bold">Email verification</h1>
      <p className="mt-3 text-slate-500">{status}</p>
      <Link className="mt-8 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-dark" to="/login">Continue to sign in</Link>
    </div>
  )
}

export default VerifyEmailPage
