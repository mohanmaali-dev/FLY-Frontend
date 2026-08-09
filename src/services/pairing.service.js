import { supabase, unwrap } from './supabase.js'
import { toUserError, userError } from '../utils/errors.js'
import { deleteSessionFiles } from './storage.service.js'

const mapSession = (row) => ({
  sessionId: row.id,
  code: row.code || '',
  status: row.status,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
})

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Strips separators and normalises case: "k7m-3qx" and "K7M3QX" are the same. */
export const normaliseCode = (value = '') =>
  value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 6)

/** Displayed as two groups of three — far easier to read off a screen. */
export const formatCode = (code = '') => {
  const clean = normaliseCode(code)
  return clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean
}

export const isSessionCode = (value = '') => normaliseCode(value).length === 6

/**
 * Created through an RPC rather than a table insert: the table has no SELECT
 * policy (so sessions cannot be listed), and `insert().select()` would need one
 * to return the new row.
 */
export const createPairingSession = async () => {
  const rows = unwrap(await supabase.rpc('create_pairing_session'))

  const row = rows?.[0]

  if (!row) {
    throw userError('Could not start a session. Please try again.')
  }

  return mapSession(row)
}

/**
 * Reads a session through a SECURITY DEFINER function rather than a table
 * select: there is no blanket read policy, so a session is reachable only by
 * someone who already has its id. Expired sessions come back empty.
 */
export const getPairingSession = async (sessionId) => {
  const rows = unwrap(
    await supabase.rpc('get_pairing_session', { session_id: sessionId }),
  )

  const row = rows?.[0]

  if (!row) {
    throw userError('This session has ended or expired.')
  }

  return mapSession(row)
}

export const getPairingSessionByCode = async (code) => {
  const rows = unwrap(
    await supabase.rpc('get_pairing_session_by_code', {
      session_code: normaliseCode(code),
    }),
  )

  const row = rows?.[0]

  if (!row) {
    throw userError('That code is not valid. Check it and try again.')
  }

  return mapSession(row)
}

/**
 * Resolves whatever is in the URL — the join route accepts both the short code
 * and the raw session id, so old links keep working.
 */
export const resolvePairingSession = async (identifier) =>
  UUID_PATTERN.test(identifier)
    ? getPairingSession(identifier)
    : getPairingSessionByCode(identifier)

/**
 * Ends a session for good. Call `deleteSessionFiles` first — once the row is
 * gone the storage policy no longer permits clearing its folder.
 */
export const endPairingSession = async (sessionId) => {
  if (!sessionId) return

  const { error } = await supabase.rpc('end_pairing_session', {
    session_id: sessionId,
  })

  if (error) throw toUserError(error)
}

/**
 * Tears a session down completely — used by Disconnect on both the host and
 * the guest, so either side can end a transfer and take its files with it.
 *
 * Best-effort by design: a failure here must never leave the UI stuck. Whatever
 * survives is reaped when the session expires.
 */
export const destroyPairingSession = async (sessionId) => {
  if (!sessionId) return

  // Files first — the storage policy only allows clearing a folder whose
  // session is still live, so this cannot be reordered.
  try {
    await deleteSessionFiles(sessionId)
  } catch {
    /* ignore */
  }

  try {
    await endPairingSession(sessionId)
  } catch {
    /* ignore */
  }
}

export const touchPairingSession = async (sessionId, deviceCount) => {
  const { error } = await supabase.rpc('touch_pairing_session', {
    session_id: sessionId,
    device_count: deviceCount,
  })

  if (error) throw toUserError(error)
}
