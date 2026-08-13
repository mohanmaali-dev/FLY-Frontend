const EVENTS = new Set([
  'app_error',
  'pairing_connected',
  'pairing_failed',
  'reconnect_failed',
  'transfer_failed',
  'upload_failed',
])

export default function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).end()

  const body = request.body || {}
  if (!EVENTS.has(body.name)) return response.status(400).end()

  const serialized = JSON.stringify(body)
  if (serialized.length > 2_000) return response.status(413).end()

  // Vercel captures stdout as structured function logs. The browser collector
  // deliberately excludes message contents, URLs, file names and session IDs.
  console.info(JSON.stringify({
    kind: 'fly_client_event',
    name: body.name,
    route: String(body.route || '').slice(0, 80),
    properties: body.properties || {},
    occurredAt: body.occurredAt || new Date().toISOString(),
  }))

  return response.status(204).end()
}
