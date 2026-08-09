import { supabase, unwrap } from './supabase.js'
import { randomUUID } from '../utils/browser.js'
import { userError } from '../utils/errors.js'

const PAIRING_BUCKET = 'pairing-files'
const NOTE_BUCKET = 'note-images'

export const MAX_FILE_BYTES = 50 * 1024 * 1024

// Storage keys must be ASCII-safe; the original name is kept in the message
// payload so the receiving device still shows and downloads it correctly.
const safeName = (name) =>
  name.replace(/[^\w.-]+/g, '_').slice(-96) || 'file'

const publicUrl = (bucket, path) =>
  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl

/**
 * Uploads into a folder named after the pairing session. The storage policy
 * rejects any path whose first segment is not a live session, so an expired
 * or made-up id cannot be used to park files in the bucket.
 */
export const uploadPairingFile = async (sessionId, file) => {
  if (file.size > MAX_FILE_BYTES) {
    throw userError('That file is too large. The limit is 50 MB.')
  }

  const path = `${sessionId}/${randomUUID()}-${safeName(file.name)}`

  unwrap(
    await supabase.storage
      .from(PAIRING_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream' }),
  )

  return {
    fileName: file.name,
    fileUrl: publicUrl(PAIRING_BUCKET, path),
    fileSize: file.size,
    mimeType: file.type || '',
  }
}

/**
 * Removes every file shared in a session. Called when the user disconnects, so
 * nothing they sent is left sitting in the bucket.
 *
 * Must run BEFORE the session row is deleted: the storage policy only allows
 * clearing a folder that belongs to a session which is still live.
 */
export const deleteSessionFiles = async (sessionId) => {
  if (!sessionId) return 0

  const pageSize = 100
  let removed = 0
  let offset = 0

  // list() is paginated, and a busy session can hold more than one page.
  for (;;) {
    const { data, error } = await supabase.storage
      .from(PAIRING_BUCKET)
      .list(sessionId, { limit: pageSize, offset })

    if (error || !data?.length) break

    const paths = data.map((entry) => `${sessionId}/${entry.name}`)
    const { error: removeError } = await supabase.storage
      .from(PAIRING_BUCKET)
      .remove(paths)

    if (removeError) break

    removed += paths.length

    // Removed entries leave the listing, so the window does not advance.
    if (data.length < pageSize) break
  }

  return removed
}

export const uploadNoteImage = async (userId, file) => {
  if (!file.type.startsWith('image/')) {
    throw userError('Please choose an image file.')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw userError('That image is too large. The limit is 5 MB.')
  }

  const path = `${userId}/${randomUUID()}-${safeName(file.name)}`

  unwrap(
    await supabase.storage
      .from(NOTE_BUCKET)
      .upload(path, file, { contentType: file.type }),
  )

  return publicUrl(NOTE_BUCKET, path)
}
