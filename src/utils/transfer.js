export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const MAX_TEXT_LENGTH = 20_000
export const MAX_LINK_LENGTH = 2_048
export const MAX_LINK_NOTE_LENGTH = 500
export const MAX_HISTORY_ITEMS = 100

const hasControlCharacters = (value) =>
  Array.from(value).some((character) => {
    const code = character.codePointAt(0)
    return code < 32 || code === 127
  })

export const validateShareFile = (file) => {
  if (!file) return 'Choose a file first.'
  if (!file.name?.trim()) return 'That file does not have a valid name.'
  if (hasControlCharacters(file.name)) return 'That file name contains unsupported characters.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_FILE_BYTES) return 'That file is too large. The limit is 50 MB.'
  return ''
}

export const normalizeShareUrl = (value = '') => {
  const input = value.trim()
  if (!input) throw new Error('Enter a link first.')
  if (input.length > MAX_LINK_LENGTH) throw new Error('That link is too long.')

  const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`
  let url

  try {
    url = new URL(candidate)
  } catch {
    throw new Error('Enter a valid web address.')
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Only http and https links can be shared.')
  }

  return url.toString()
}

export const addOrReplaceTransfer = (items, item) => {
  const withoutDuplicate = items.filter((entry) => entry.id !== item.id)
  return [item, ...withoutDuplicate].slice(0, MAX_HISTORY_ITEMS)
}

export const createSlidingWindowLimiter = ({ limit = 12, windowMs = 10_000 } = {}) => {
  let timestamps = []

  return () => {
    const now = Date.now()
    timestamps = timestamps.filter((timestamp) => now - timestamp < windowMs)

    if (timestamps.length >= limit) return false
    timestamps.push(now)
    return true
  }
}
