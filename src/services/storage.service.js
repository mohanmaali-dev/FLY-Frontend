import { supabase, supabaseConfig, unwrap } from './supabase.js'
import { randomUUID } from '../utils/browser.js'
import { userError } from '../utils/errors.js'
import { MAX_FILE_BYTES, validateShareFile } from '../utils/transfer.js'

const PAIRING_BUCKET = 'pairing-files'

export { MAX_FILE_BYTES }

// Storage keys must be ASCII-safe; the original name is kept in the message
// payload so the receiving device still shows and downloads it correctly.
const safeName = (name) =>
  name.replace(/[^\w.-]+/g, '_').slice(-96) || 'file'

const encodeStoragePath = (path) =>
  path.split('/').map((segment) => encodeURIComponent(segment)).join('/')

const createSignedUrl = async (bucket, path, expiresIn = 60 * 60) => {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) {
    throw userError('The file uploaded, but its secure download link could not be created.')
  }
  return data.signedUrl
}

export const refreshPairingFileUrl = async (storagePath) => {
  if (!storagePath) throw userError('This file does not have a secure storage path.')
  return createSignedUrl(PAIRING_BUCKET, storagePath)
}

/**
 * Uploads into a folder named after the pairing session. The storage policy
 * rejects any path whose first segment is not a live session, so an expired
 * or made-up id cannot be used to park files in the bucket.
 */
export const uploadPairingFile = async (
  sessionId,
  file,
  { onProgress, signal } = {},
) => {
  const validationError = validateShareFile(file)
  if (validationError) throw userError(validationError)

  const path = `${sessionId}/${randomUUID()}-${safeName(file.name)}`
  const endpoint = `${supabaseConfig.url}/storage/v1/object/${PAIRING_BUCKET}/${encodeStoragePath(path)}`

  await new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    let settled = false

    const finish = (callback) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abortUpload)
      callback()
    }

    const abortUpload = () => {
      request.abort()
      finish(() => reject(userError('Upload cancelled.')))
    }

    request.open('POST', endpoint)
    request.setRequestHeader('apikey', supabaseConfig.anonKey)
    request.setRequestHeader('Authorization', `Bearer ${supabaseConfig.anonKey}`)
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    request.setRequestHeader('x-upsert', 'false')

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return
      onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    })

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100)
        finish(resolve)
        return
      }

      let detail = ''
      try {
        const body = JSON.parse(request.responseText)
        detail = body.message || body.error || ''
      } catch {
        detail = request.statusText
      }
      finish(() => reject(userError(detail || 'File upload failed.')))
    })

    request.addEventListener('error', () =>
      finish(() => reject(userError('Upload interrupted. Check your connection and try again.'))),
    )
    request.addEventListener('abort', () =>
      finish(() => reject(userError('Upload cancelled.'))),
    )

    signal?.addEventListener('abort', abortUpload, { once: true })
    if (signal?.aborted) {
      abortUpload()
      return
    }

    request.send(file)
  })

  const fileUrl = await createSignedUrl(PAIRING_BUCKET, path)

  return {
    fileName: file.name,
    fileUrl,
    storagePath: path,
    fileSize: file.size,
    mimeType: file.type || '',
  }
}

export const deletePairingFile = async (storagePath) => {
  if (!storagePath) return
  unwrap(await supabase.storage.from(PAIRING_BUCKET).remove([storagePath]))
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
