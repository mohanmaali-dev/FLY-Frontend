import { createClient } from '@supabase/supabase-js'

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'GET') return response.status(405).json({ status: 'method_not_allowed' })

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return response.status(503).json({ status: 'configuration_required' })

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { error } = await supabase.from('pairing_sessions').select('id').limit(1)
    if (error) throw error

    return response.status(200).json({ status: 'ok' })
  } catch (error) {
    console.error('Health check failed:', error)
    return response.status(503).json({ status: 'degraded' })
  }
}
