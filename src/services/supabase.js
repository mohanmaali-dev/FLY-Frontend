import { createClient } from '@supabase/supabase-js'

import { toUserError } from '../utils/errors.js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Storage's standard upload helper does not expose browser upload progress.
// These public client credentials are also used by the XHR uploader; the anon
// key is safe to ship and remains constrained by Row Level Security.
export const supabaseConfig = { url, anonKey }

/**
 * False until both variables are set. main.jsx renders setup instructions
 * rather than mounting the app, so no service ever sees a null client.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Email confirmation and password-recovery links come back with
        // tokens in the URL fragment; this exchanges them for a session.
        detectSessionInUrl: true,
      },
      realtime: {
        // Pairing is chatty only in bursts; 10/sec is plenty and keeps us
        // well inside the free tier's message quota.
        params: { eventsPerSecond: 10 },
      },
    })
  : null

/**
 * supabase-js rejects with Postgres error shapes whose messages are written for
 * developers. Translate here, once, so no caller has to remember to — and so a
 * database detail never reaches the screen.
 */
export const unwrap = ({ data, error }) => {
  if (error) {
    throw toUserError(error)
  }

  return data
}
