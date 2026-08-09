/**
 * Secure-context fallbacks.
 *
 * Pairing is meant to be opened from a phone over the LAN — e.g.
 * http://192.168.1.5:5173 — which is NOT a secure context. Browsers withhold
 * `crypto.randomUUID` and `navigator.clipboard` there, so using them directly
 * throws and takes the whole page down with it.
 *
 * `crypto.getRandomValues` and `document.execCommand('copy')` are both
 * available over plain HTTP, so they make solid fallbacks.
 */

const HEX = Array.from({ length: 256 }, (_, i) => (i + 0x100).toString(16).slice(1))

/** RFC 4122 version 4 UUID, built from whatever randomness is available. */
export const randomUUID = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    // Ancient or exotic browser. Ids only need to be collision-free between a
    // handful of devices in one session, not unpredictable.
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10

  return (
    `${HEX[bytes[0]]}${HEX[bytes[1]]}${HEX[bytes[2]]}${HEX[bytes[3]]}-` +
    `${HEX[bytes[4]]}${HEX[bytes[5]]}-` +
    `${HEX[bytes[6]]}${HEX[bytes[7]]}-` +
    `${HEX[bytes[8]]}${HEX[bytes[9]]}-` +
    `${HEX[bytes[10]]}${HEX[bytes[11]]}${HEX[bytes[12]]}${HEX[bytes[13]]}${HEX[bytes[14]]}${HEX[bytes[15]]}`
  )
}

/** Copies text to the clipboard. Resolves to whether it worked. */
export const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission denied, or a non-secure context that still exposes the API.
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    // Keep it off-screen and non-scrolling, but still selectable.
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-1000px'
    textarea.style.opacity = '0'

    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, text.length)

    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)

    return copied
  } catch {
    return false
  }
}
