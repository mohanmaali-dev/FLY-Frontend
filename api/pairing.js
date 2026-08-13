import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const WINDOW_SECONDS = 10 * 60
const LIMITS = { create: 8, resolve: 20 }

const json = (response, status, body) => {
  response.setHeader('Cache-Control', 'no-store')
  return response.status(status).json(body)
}

const rpc = async (name, args = {}) => {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Pairing gateway is not configured.')

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(error.message || 'Pairing request failed.')
  return data
}

const requesterKey = (request) => {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const address = forwarded || request.socket?.remoteAddress || 'unknown'
  const salt =
    process.env.RATE_LIMIT_SALT ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  return createHmac('sha256', salt || 'missing-salt').update(address).digest('hex')
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, 405, { message: 'Method not allowed.' })

  const requestOrigin = request.headers.origin
  const forwardedHost = request.headers['x-forwarded-host'] || request.headers.host
  if (requestOrigin && forwardedHost) {
    try {
      if (new URL(requestOrigin).host !== forwardedHost) {
        return json(response, 403, { message: 'Cross-origin pairing requests are not allowed.' })
      }
    } catch {
      return json(response, 403, { message: 'Invalid request origin.' })
    }
  }

  const action = request.body?.action
  if (!Object.hasOwn(LIMITS, action)) return json(response, 400, { message: 'Invalid pairing action.' })

  try {
    const allowed = await rpc('check_pairing_rate_limit', {
      p_request_key: requesterKey(request),
      p_request_action: action,
      p_max_attempts: LIMITS[action],
      p_window_seconds: WINDOW_SECONDS,
    })

    if (!allowed) {
      response.setHeader('Retry-After', String(WINDOW_SECONDS))
      return json(response, 429, { message: 'Too many pairing attempts. Try again in a few minutes.' })
    }

    if (action === 'create') {
      const rows = await rpc('create_pairing_session')
      return json(response, 200, { data: rows?.[0] || null })
    }

    const code = String(request.body?.code || '').replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 6)
    if (code.length !== 6) return json(response, 400, { message: 'Enter a valid six-character code.' })
    const rows = await rpc('get_pairing_session_by_code', { session_code: code })
    return json(response, 200, { data: rows?.[0] || null })
  } catch (error) {
    console.error('Pairing gateway error:', error)
    return json(response, 503, { message: 'The pairing service is temporarily unavailable.' })
  }
}
