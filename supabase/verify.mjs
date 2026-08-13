/**
 * Verifies the Supabase backend end to end, using only the anon key — exactly
 * the access the browser has.
 *
 *   npm run verify:supabase
 *
 * Reports what is missing if the schema has not been applied, otherwise
 * exercises pairing (RPCs, Realtime presence, Broadcast) and Storage policies.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const projectRoot = dirname(import.meta.dirname)

const readEnv = () =>
  Object.fromEntries(
    readFileSync(join(projectRoot, '.env'), 'utf8')
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
      }),
  )

const results = []
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)

const deadline = (label, ms = 15000) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out: ${label}`)), ms))

async function main() {
  const env = readEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env first.')
    return 1
  }

  // autoRefreshToken off: its timer would otherwise keep the process alive.
  const make = () =>
    createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

  const host = make()
  const guest = make()

  const cleanup = async () => {
    await host.removeAllChannels().catch(() => {})
    await guest.removeAllChannels().catch(() => {})
  }

  // ── 0. Is the schema applied at all? ──────────────────────────────────────
  const probe = await host.rpc('create_pairing_session')

  if (probe.error && /Could not find the function|schema cache/i.test(probe.error.message)) {
    console.log(`project : ${url}\n`)
    console.log('The schema has not been applied yet.\n')
    console.log('  Supabase Dashboard -> SQL Editor -> New query')
    console.log('  Paste all of supabase/schema.sql, then Run.\n')
    console.log('Re-run this script afterwards to verify.')
    await cleanup()
    return 2
  }

  const session = probe.data?.[0]
  check('create_pairing_session', Boolean(session?.id), probe.error?.message || session?.id)

  if (!session?.id) {
    await cleanup()
    return 1
  }

  check('new session starts as waiting', session.status === 'waiting', session.status)

  // ── Short join code ───────────────────────────────────────────────────────
  const CODE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/ // Crockford base32, no I/L/O/U

  if (!session.code) {
    check(
      'session has a short join code',
      false,
      'no code returned — re-run supabase/schema.sql to add it',
    )
  } else {
    check('session has a 6-char code', CODE.test(session.code), session.code)

    const byCode = await host.rpc('get_pairing_session_by_code', {
      session_code: session.code,
    })
    check(
      'get_pairing_session_by_code',
      byCode.data?.[0]?.id === session.id,
      byCode.error?.message || '',
    )

    const messy = `${session.code.slice(0, 3).toLowerCase()}-${session.code.slice(3).toLowerCase()}`
    const lowered = await host.rpc('get_pairing_session_by_code', {
      session_code: messy,
    })
    check(
      'code lookup ignores case and dashes',
      lowered.data?.[0]?.id === session.id,
      `"${messy}" -> ${lowered.error?.message || 'matched'}`,
    )

    const badCode = await host.rpc('get_pairing_session_by_code', {
      session_code: 'ZZZZZZ',
    })
    check('unknown code returns empty', (badCode.data?.length ?? 0) === 0)

    // Codes must not repeat, or one device would join another's session.
    const extra = await Promise.all(
      Array.from({ length: 5 }, () => host.rpc('create_pairing_session')),
    )
    const codes = extra.map((result) => result.data?.[0]?.code).filter(Boolean)
    check(
      'codes are unique across sessions',
      codes.length === 5 && new Set(codes).size === 5,
      codes.join(', '),
    )
    check(
      'all generated codes are well-formed',
      codes.length > 0 && codes.every((value) => CODE.test(value)),
    )

    for (const result of extra) {
      const id = result.data?.[0]?.id
      if (id) await host.rpc('end_pairing_session', { session_id: id })
    }
  }

  // ── 1. Readable by id, and only by id ───────────────────────────────────────
  const fetched = await host.rpc('get_pairing_session', { session_id: session.id })
  check('get_pairing_session', fetched.data?.[0]?.id === session.id, fetched.error?.message || '')

  const missing = await host.rpc('get_pairing_session', {
    session_id: '00000000-0000-4000-8000-000000000000',
  })
  check('unknown session returns empty', (missing.data?.length ?? 0) === 0)

  const listed = await host.from('pairing_sessions').select('id')
  check(
    'sessions are not listable (RLS)',
    (listed.data?.length ?? 0) === 0,
    listed.error ? `blocked: ${listed.error.code}` : `${listed.data?.length ?? 0} rows returned`,
  )

  const browserRateLimitAttempt = await host.rpc('check_pairing_rate_limit', {
    p_request_key: '0'.repeat(64),
    p_request_action: 'create',
    p_max_attempts: 1,
    p_window_seconds: 60,
  })
  check(
    'rate-limit counter is server-only',
    Boolean(browserRateLimitAttempt.error),
    browserRateLimitAttempt.error ? 'blocked for anon client' : 'ALLOWED — revoke the browser grant',
  )

  // ── 2. Realtime presence + broadcast ──────────────────────────────────────
  const deviceA = { id: 'verify-host', name: 'Host PC', type: 'desktop' }
  const deviceB = { id: 'verify-guest', name: 'Phone', type: 'mobile' }

  const channelFor = (client, device) =>
    client.channel(`pairing:${session.id}`, {
      config: { presence: { key: device.id }, broadcast: { self: false } },
    })

  const chA = channelFor(host, deviceA)
  const chB = channelFor(guest, deviceB)

  const bothPresent = new Promise((resolve) => {
    chA.on('presence', { event: 'sync' }, () => {
      const devices = Object.values(chA.presenceState())
        .map((entry) => entry[0]?.device)
        .filter(Boolean)
      if (devices.length === 2) resolve(devices)
    })
  })

  const messageArrived = new Promise((resolve) => {
    chA.on('broadcast', { event: 'device:message' }, ({ payload }) => resolve(payload))
  })

  const subscribe = (channel, device) =>
    new Promise((resolve, reject) => {
      channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ device })
          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`${status}: ${error?.message || 'no detail'}`))
        }
      })
    })

  try {
    await Promise.race([subscribe(chA, deviceA), deadline('host subscribe')])
    await Promise.race([subscribe(chB, deviceB), deadline('guest subscribe')])
    check('both devices subscribe', true)

    const devices = await Promise.race([bothPresent, deadline('presence sync')])
    check('presence lists both devices', devices.length === 2, devices.map((d) => d.name).join(', '))

    const ack = await chB.send({
      type: 'broadcast',
      event: 'device:message',
      payload: {
        id: 'verify-1',
        itemType: 'text',
        text: 'hello from the guest',
        sender: deviceB.name,
        timestamp: new Date().toISOString(),
      },
    })
    check('broadcast acknowledged', ack === 'ok', String(ack))

    const message = await Promise.race([messageArrived, deadline('broadcast delivery')])
    check('message relays guest -> host', message.text === 'hello from the guest')
    check('sender travels with the message', message.sender === 'Phone', message.sender)
  } catch (error) {
    check('realtime pairing', false, error.message)
  }

  // ── 3. Status transition ──────────────────────────────────────────────────
  const touched = await host.rpc('touch_pairing_session', {
    session_id: session.id,
    device_count: 2,
  })
  check('touch_pairing_session', !touched.error, touched.error?.message || '')

  const afterTouch = await host.rpc('get_pairing_session', { session_id: session.id })
  check('status flips to paired', afterTouch.data?.[0]?.status === 'paired', afterTouch.data?.[0]?.status)

  // ── 4. Storage policies ───────────────────────────────────────────────────
  const body = new Blob(['hello fly'], { type: 'text/plain' })
  const path = `${session.id}/${crypto.randomUUID()}-verify.txt`

  const upload = await host.storage
    .from('pairing-files')
    .upload(path, body, { contentType: 'text/plain' })
  check('upload into a live session', !upload.error, upload.error?.message || '')

  if (!upload.error) {
    const publicUrl = host.storage.from('pairing-files').getPublicUrl(path).data.publicUrl
    const publicDownload = await fetch(publicUrl)
    check('pairing file is not publicly readable', !publicDownload.ok, String(publicDownload.status))

    const signed = await host.storage.from('pairing-files').createSignedUrl(path, 60)
    const download = signed.data?.signedUrl ? await fetch(signed.data.signedUrl) : null
    check('signed pairing file is readable', Boolean(download?.ok) && (await download.text()) === 'hello fly', signed.error?.message || '')
  }

  const badUpload = await host.storage
    .from('pairing-files')
    .upload(`00000000-0000-4000-8000-000000000000/${crypto.randomUUID()}.txt`, body, {
      contentType: 'text/plain',
    })
  check(
    'upload into an unknown session is refused',
    Boolean(badUpload.error),
    badUpload.error ? `blocked: ${badUpload.error.message}` : 'ALLOWED — policy is not working',
  )

  // ── 5. Disconnect wipes the session's files, then ends the session ────────
  const listBefore = await host.storage.from('pairing-files').list(session.id)
  check('session folder has the uploaded file', (listBefore.data?.length ?? 0) > 0,
    `${listBefore.data?.length ?? 0} file(s)`)

  const toRemove = (listBefore.data || []).map((entry) => `${session.id}/${entry.name}`)
  const removed = await host.storage.from('pairing-files').remove(toRemove)
  check('files can be deleted by the client', !removed.error, removed.error?.message || '')

  const listAfter = await host.storage.from('pairing-files').list(session.id)
  check('session folder is empty afterwards', (listAfter.data?.length ?? 0) === 0,
    `${listAfter.data?.length ?? 0} file(s) left`)

  const ended = await host.rpc('end_pairing_session', { session_id: session.id })
  check('end_pairing_session', !ended.error, ended.error?.message || '')

  const afterEnd = await host.rpc('get_pairing_session', { session_id: session.id })
  check('ended session stops resolving', (afterEnd.data?.length ?? 0) === 0)

  await cleanup()

  console.log(results.join('\n'))

  const failed = results.some((r) => r.startsWith('FAIL'))
  console.log(`\n${failed ? 'FAILED' : 'All checks passed.'}`)

  return failed ? 1 : 0
}

// Set exitCode rather than calling process.exit(): an abrupt exit while the
// realtime client still holds handles trips a libuv assertion on Windows.
process.exitCode = await main()
