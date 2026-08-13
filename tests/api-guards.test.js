import assert from 'node:assert/strict'
import test from 'node:test'

import pairingHandler from '../api/pairing.js'
import telemetryHandler from '../api/telemetry.js'
import cleanupHandler from '../api/cleanup.js'
import healthHandler from '../api/health.js'

const responseMock = () => ({
  statusCode: 200,
  headers: {},
  body: undefined,
  setHeader(key, value) { this.headers[key] = value },
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  end() { return this },
})

test('pairing gateway rejects unsupported methods before backend access', async () => {
  const response = responseMock()
  await pairingHandler({ method: 'GET', headers: {} }, response)
  assert.equal(response.statusCode, 405)
})

test('pairing gateway rejects cross-origin requests', async () => {
  const response = responseMock()
  await pairingHandler({
    method: 'POST',
    headers: { origin: 'https://attacker.example', host: 'fly.example' },
    body: { action: 'create' },
  }, response)
  assert.equal(response.statusCode, 403)
})

test('telemetry collector rejects unknown event names', () => {
  const response = responseMock()
  telemetryHandler({ method: 'POST', body: { name: 'shared_file_contents' } }, response)
  assert.equal(response.statusCode, 400)
})

test('cleanup endpoint requires the configured cron authorization', async () => {
  const previous = process.env.CRON_SECRET
  delete process.env.CRON_SECRET
  const response = responseMock()

  await cleanupHandler({ method: 'GET', headers: {} }, response)
  assert.equal(response.statusCode, 401)

  if (previous) process.env.CRON_SECRET = previous
})

test('health endpoint rejects unsupported methods without backend access', async () => {
  const response = responseMock()
  await healthHandler({ method: 'POST', headers: {} }, response)
  assert.equal(response.statusCode, 405)
})
