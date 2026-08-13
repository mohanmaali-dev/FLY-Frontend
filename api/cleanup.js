import { createClient } from '@supabase/supabase-js'

const json = (response, status, body) => {
  response.setHeader('Cache-Control', 'no-store')
  return response.status(status).json(body)
}

const getAdminClient = () => {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Cleanup service is not configured.')

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return json(response, 405, { message: 'Method not allowed.' })

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.authorization !== `Bearer ${cronSecret}`) {
    return json(response, 401, { message: 'Unauthorized.' })
  }

  try {
    const supabase = getAdminClient()
    const { data: sessions, error } = await supabase
      .from('pairing_sessions')
      .select('id')
      .lt('expires_at', new Date().toISOString())
      .limit(100)

    if (error) throw error

    let removedFiles = 0
    let removedSessions = 0

    for (const session of sessions || []) {
      for (;;) {
        const { data: files, error: listError } = await supabase.storage
          .from('pairing-files')
          .list(session.id, { limit: 100, offset: 0 })

        if (listError) throw listError
        if (!files?.length) break

        const paths = files.map((file) => `${session.id}/${file.name}`)
        const { error: removeError } = await supabase.storage
          .from('pairing-files')
          .remove(paths)

        if (removeError) throw removeError
        removedFiles += paths.length
        if (files.length < 100) break
      }

      const { error: sessionError } = await supabase
        .from('pairing_sessions')
        .delete()
        .eq('id', session.id)

      if (sessionError) throw sessionError
      removedSessions += 1
    }

    console.info(JSON.stringify({ kind: 'fly_cleanup', removedFiles, removedSessions }))
    return json(response, 200, { ok: true, removedFiles, removedSessions })
  } catch (error) {
    console.error('Expired file cleanup failed:', error)
    return json(response, 503, { ok: false, message: 'Cleanup could not complete.' })
  }
}
