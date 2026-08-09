import { supabase, unwrap } from './supabase.js'
import { toUserError, userError } from '../utils/errors.js'

/**
 * Shapes a Supabase user + profile row into the object the UI already expects,
 * so pages keep using `user.name` / `user.isEmailVerified` unchanged.
 */
export const mapUser = (authUser, profile = null) => {
  if (!authUser) return null

  return {
    id: authUser.id,
    email: authUser.email,
    name:
      profile?.name ||
      authUser.user_metadata?.name ||
      authUser.email?.split('@')[0] ||
      'User',
    role: profile?.role || 'user',
    isActive: profile?.is_active ?? true,
    isEmailVerified: Boolean(authUser.email_confirmed_at),
  }
}

const loadProfile = async (userId) => {
  // maybeSingle: the row is created by a trigger, so on the very first render
  // after signup it can briefly not exist yet. Missing must not throw.
  const { data, error } = await supabase
    .from('profiles')
    .select('name, role, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (error) return null

  return data
}

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return mapUser(user, await loadProfile(user.id))
}

/**
 * Name, email, password — and you are signed in. There is no confirmation step.
 *
 * That requires "Confirm email" to be OFF in the Supabase dashboard
 * (Authentication -> Sign In / Providers -> Email). With it on, Supabase
 * withholds the session until the link is clicked, so we surface a precise
 * error rather than appearing to succeed and then bouncing to /login.
 */
export const register = async ({ name, email, password }) => {
  const data = unwrap(
    await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    }),
  )

  if (!data.session) {
    throw new Error(
      'Account created, but sign-in is blocked because email confirmation is ' +
        'still enabled. Turn off "Confirm email" in the Supabase dashboard ' +
        '(Authentication → Sign In / Providers → Email), then log in.',
    )
  }

  return { user: mapUser(data.user, await loadProfile(data.user.id)) }
}

export const login = async ({ email, password }) => {
  const data = unwrap(await supabase.auth.signInWithPassword({ email, password }))

  const profile = await loadProfile(data.user.id)

  if (profile && profile.is_active === false) {
    await supabase.auth.signOut()
    throw userError('This account has been deactivated.')
  }

  return { user: mapUser(data.user, profile) }
}

export const logout = async () => {
  const { error } = await supabase.auth.signOut()

  if (error) throw toUserError(error)
}

export const forgotPassword = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })

  if (error) throw toUserError(error)

  // Matches the old backend, which never revealed whether the address existed.
  return { message: 'If that email is registered, a reset link is on its way.' }
}

/**
 * The recovery link signs the user in with a short-lived session before landing
 * on /reset-password, so setting the new password is just an update — there is
 * no separate token to pass around any more.
 */
export const resetPassword = async (password) => {
  const { error } = await supabase.auth.updateUser({ password })

  if (error) throw toUserError(error)

  return { message: 'Password updated. You can sign in with it now.' }
}

export const onAuthStateChange = (callback) =>
  supabase.auth.onAuthStateChange((event, session) => callback(event, session))

export const getSession = async () => {
  const { data } = await supabase.auth.getSession()

  return data.session
}
