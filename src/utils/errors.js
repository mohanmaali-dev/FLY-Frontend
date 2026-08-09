/**
 * Turns whatever a library threw into something a person can act on.
 *
 * Supabase, PostgREST and the browser all raise messages written for
 * developers — "new row violates row-level security policy", "Failed to fetch",
 * "JWT expired". Rendering those in the UI tells a user nothing and leaks how
 * the system is built. The real error still goes to the console.
 */

class UserFacingError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UserFacingError'
    this.userFacing = true
  }
}

/** Message we wrote ourselves and are happy to show verbatim. */
export const userError = (message) => new UserFacingError(message)

const GENERIC = 'Something went wrong. Please try again.'

// Ordered: first match wins.
const TRANSLATIONS = [
  {
    test: /failed to fetch|networkerror|network request failed|fetch failed|load failed/i,
    message: 'Cannot reach the server. Check your connection and try again.',
  },
  {
    test: /row-level security|permission denied|not authorized|insufficient privilege/i,
    message: 'This session is no longer available.',
  },
  {
    test: /jwt|token is expired|invalid claim|refresh_token/i,
    message: 'Your sign-in has expired. Please sign in again.',
  },
  {
    test: /invalid login credentials/i,
    message: 'That email or password is not correct.',
  },
  {
    test: /already registered|already exists/i,
    message: 'An account with that email already exists.',
  },
  {
    test: /password should be at least (\d+)/i,
    message: 'Please choose a longer password.',
  },
  {
    test: /email not confirmed/i,
    message: 'Confirm your email address before signing in.',
  },
  {
    test: /rate limit|too many requests/i,
    message: 'Too many attempts. Please wait a moment and try again.',
  },
  {
    test: /payload too large|maximum allowed size|exceeded the maximum/i,
    message: 'That file is too large to send.',
  },
  {
    test: /could not find the function|schema cache|does not exist|undefined column/i,
    message: 'This feature is unavailable right now.',
  },
  {
    test: /timeout|timed out/i,
    message: 'That took too long. Please try again.',
  },
]

/**
 * @param {unknown} error
 * @param {string} [fallback] shown when nothing else matches
 * @returns {string} safe to render
 */
export const toUserMessage = (error, fallback = GENERIC) => {
  if (!error) return fallback

  // Anything we authored is already written for a person.
  if (error.userFacing) return error.message

  const raw = typeof error === 'string' ? error : error.message || ''
  if (!raw) return fallback

  const match = TRANSLATIONS.find((entry) => entry.test.test(raw))

  // Keep the real message where a developer can see it.
  console.error('[FLY]', error)

  return match ? match.message : fallback
}

/** Wraps a thrown value so the message is safe by the time it reaches state. */
export const toUserError = (error, fallback) =>
  error?.userFacing ? error : userError(toUserMessage(error, fallback))
