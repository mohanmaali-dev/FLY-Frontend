import assert from 'node:assert/strict'
import test from 'node:test'

import { selectSessionDevices } from '../src/utils/session-admission.js'

test('admits the host and earliest guest only', () => {
  const admitted = selectSessionDevices([
    { id: 'late', role: 'guest', joinedAt: 30 },
    { id: 'host', role: 'host', joinedAt: 50 },
    { id: 'early', role: 'guest', joinedAt: 20 },
  ])

  assert.deepEqual(admitted.map((device) => device.id), ['host', 'early'])
})

test('uses device id as a stable tie breaker', () => {
  const admitted = selectSessionDevices([
    { id: 'guest-b', role: 'guest', joinedAt: 20 },
    { id: 'host', role: 'host', joinedAt: 10 },
    { id: 'guest-a', role: 'guest', joinedAt: 20 },
  ])

  assert.deepEqual(admitted.map((device) => device.id), ['host', 'guest-a'])
})
