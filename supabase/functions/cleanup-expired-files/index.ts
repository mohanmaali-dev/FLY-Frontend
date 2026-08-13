import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const authorization = request.headers.get('authorization') || ''
  if (!serviceKey || authorization !== `Bearer ${serviceKey}`) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: sessions, error } = await supabase
    .from('pairing_sessions')
    .select('id')
    .lt('expires_at', new Date().toISOString())
    .limit(100)

  if (error) return json({ error: error.message }, 500)

  let removedFiles = 0
  let removedSessions = 0

  for (const session of sessions || []) {
    // Always list from offset zero because each successful remove shortens the
    // folder. Batches keep requests below Storage API payload limits.
    for (;;) {
      const { data: files, error: listError } = await supabase.storage
        .from('pairing-files')
        .list(session.id, { limit: 100, offset: 0 })

      if (listError) return json({ error: listError.message }, 500)
      if (!files?.length) break

      const paths = files.map((file) => `${session.id}/${file.name}`)
      const { error: removeError } = await supabase.storage
        .from('pairing-files')
        .remove(paths)

      if (removeError) return json({ error: removeError.message }, 500)
      removedFiles += paths.length
      if (files.length < 100) break
    }

    const { error: sessionError } = await supabase
      .from('pairing_sessions')
      .delete()
      .eq('id', session.id)

    if (!sessionError) removedSessions += 1
  }

  return json({ removedFiles, removedSessions })
})
