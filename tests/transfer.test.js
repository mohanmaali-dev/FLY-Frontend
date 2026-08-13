import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addOrReplaceTransfer,
  createSlidingWindowLimiter,
  MAX_FILE_BYTES,
  normalizeShareUrl,
  validateShareFile,
} from '../src/utils/transfer.js'

test('normalizes a domain into a secure URL', () => {
  assert.equal(normalizeShareUrl('example.com/path'), 'https://example.com/path')
})

test('keeps valid http and https links', () => {
  assert.equal(normalizeShareUrl('http://example.com'), 'http://example.com/')
  assert.equal(normalizeShareUrl('https://example.com'), 'https://example.com/')
})

test('rejects unsafe URL schemes', () => {
  assert.throws(() => normalizeShareUrl('javascript:alert(1)'), /valid web address|Only http/)
})

test('validates empty, oversized, and malformed files', () => {
  assert.match(validateShareFile({ name: 'empty.txt', size: 0 }), /empty/)
  assert.match(validateShareFile({ name: 'large.zip', size: MAX_FILE_BYTES + 1 }), /too large/)
  assert.match(validateShareFile({ name: 'bad\u0000name', size: 10 }), /unsupported/)
  assert.equal(validateShareFile({ name: 'photo.png', size: 10 }), '')
})

test('deduplicates transfer retries and keeps the newest state', () => {
  const initial = [{ id: 'first', text: 'old' }, { id: 'second', text: 'keep' }]
  assert.deepEqual(addOrReplaceTransfer(initial, { id: 'first', text: 'new' }), [
    { id: 'first', text: 'new' },
    { id: 'second', text: 'keep' },
  ])
})

test('limits transfer history growth', () => {
  const items = Array.from({ length: 120 }, (_, index) => ({ id: String(index) }))
  assert.equal(addOrReplaceTransfer(items, { id: 'new' }).length, 100)
})

test('throttles a burst after the configured limit', () => {
  const allow = createSlidingWindowLimiter({ limit: 2, windowMs: 60_000 })
  assert.equal(allow(), true)
  assert.equal(allow(), true)
  assert.equal(allow(), false)
})
