import { supabase, unwrap } from './supabase.js'
import { toUserError, userError } from '../utils/errors.js'
import { uploadNoteImage } from './storage.service.js'

const requireUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw userError('Please sign in first.')

  return user.id
}

export const getNotes = async () =>
  unwrap(
    await supabase
      .from('notes')
      .select('id, title, content, image, created_at, updated_at')
      .order('created_at', { ascending: false }),
  )

export const createNote = async ({ title, content, image }) => {
  const userId = await requireUserId()

  return unwrap(
    await supabase
      .from('notes')
      .insert({
        user_id: userId,
        title,
        content: content || '',
        image: image ? await uploadNoteImage(userId, image) : null,
      })
      .select('id, title, content, image, created_at, updated_at')
      .single(),
  )
}

export const updateNote = async (noteId, { title, content, image }) => {
  const userId = await requireUserId()

  const patch = { title, content: content || '' }

  // Leave the existing image alone unless a new file was picked.
  if (image) {
    patch.image = await uploadNoteImage(userId, image)
  }

  return unwrap(
    await supabase
      .from('notes')
      .update(patch)
      .eq('id', noteId)
      .select('id, title, content, image, created_at, updated_at')
      .single(),
  )
}

export const deleteNote = async (noteId) => {
  const { error } = await supabase.from('notes').delete().eq('id', noteId)

  if (error) throw toUserError(error)
}
