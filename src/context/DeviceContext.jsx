/* oxlint-disable react/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import { useToast } from '../components/Toast.jsx'
import { userError } from '../utils/errors.js'
import { destroyPairingSession } from '../services/pairing.service.js'
import { joinPairingChannel } from '../services/realtime.service.js'
import { getStoredDevice } from '../utils/device-session.js'

const DeviceContext = createContext(null)

// ─── Storage helpers ───────────────────────────────────────────────────────────

const HISTORY_KEY = (sid) => `pairing_history_${sid}`

function loadHistory(sid) {
  if (!sid) return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY(sid))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(sid, items) {
  if (!sid) return
  try {
    localStorage.setItem(HISTORY_KEY(sid), JSON.stringify(items))
  } catch { /* storage quota or private mode – ignore */ }
}

function clearHistory(sid) {
  if (!sid) return
  try {
    localStorage.removeItem(HISTORY_KEY(sid))
  } catch { /* ignore */ }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const DeviceProvider = ({ children }) => {
  // Read the session ID once, synchronously, before any effects.
  const [sessionId, setSessionId] = useState(
    () => localStorage.getItem('pairing_session_id') || '',
  )

  const [devices, setDevices] = useState([])
  const [connected, setConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(
    sessionId ? 'connecting' : 'idle',
  )
  const [connectionError, setConnectionError] = useState('')

  // Bumped when the peer ends the session, so the page can replace the code it
  // is showing — the old one no longer resolves.
  const [endedSignal, setEndedSignal] = useState(0)

  const { toast } = useToast()

  // Load history SYNCHRONOUSLY in the state initializer so it's available
  // on the very first render and is never overwritten by the save effect
  // before the load effect can run (the StrictMode race condition).
  const [sharedItems, setSharedItems] = useState(
    () => loadHistory(localStorage.getItem('pairing_session_id') || ''),
  )

  // Keep the channel in a ref so callbacks always see the latest value without
  // needing to be declared as dependencies.
  const channelRef = useRef(null)
  const previousConnectedRef = useRef(false)

  // ── Persist history whenever items change ─────────────────────────────────
  useEffect(() => {
    if (!sessionId) return
    saveHistory(sessionId, sharedItems)
  }, [sharedItems, sessionId])

  // ── Realtime helpers ──────────────────────────────────────────────────────

  const closeChannel = useCallback(() => {
    const handle = channelRef.current
    channelRef.current = null

    if (handle) {
      // Fire-and-forget: unsubscribing is async but nothing depends on it.
      handle.close().catch(() => {})
    }
  }, [])

  const openChannel = useCallback(
    (sid) => {
      closeChannel()

      if (!sid) return

      setConnectionStatus(navigator.onLine ? 'connecting' : 'offline')

      const device = getStoredDevice()

      const handle = joinPairingChannel({
        sessionId: sid,
        device: { ...device, type: device.type || 'desktop' },
        onDevices: (list) => {
          const nowConnected = list.length > 1
          setDevices(list)
          setConnected(nowConnected)

          if (nowConnected && !previousConnectedRef.current) {
            const peer = list.find((entry) => entry.id !== device.id)
            toast({
              tone: 'success',
              title: 'Device connected',
              description: peer?.name || 'The other device is ready to share.',
            })
          }
          previousConnectedRef.current = nowConnected
        },
        onMessage: (payload) => {
          setSharedItems((prev) => [payload, ...prev])
          toast({
            tone: 'info',
            title: 'New transfer received',
            description:
              payload.fileName ||
              payload.text ||
              payload.url ||
              'Open recent transfers to view it.',
          })
        },
        onEnded: (by) => {
          // The other device disconnected and deleted the files, so the links
          // we are holding are already dead. Clear rather than show 404s.
          clearHistory(sid)
          localStorage.removeItem('pairing_session_id')
          setSharedItems([])
          setDevices([])
          setConnected(false)
          previousConnectedRef.current = false

          // A finished event, not an ongoing fault — a banner would sit there
          // describing something that already happened.
          toast({
            tone: 'info',
            title: `${by} ended the session`,
            description: 'Everything shared was deleted. A new code is ready.',
          })

          // Our session row is gone server-side, so the code we are holding is
          // dead. Tell the page to issue a fresh one.
          setEndedSignal((value) => value + 1)
        },
        onCleared: () => {
          clearHistory(sid)
          setSharedItems([])
          toast({
            tone: 'info',
            title: 'Transfer activity cleared',
            description: 'The other device cleared the shared activity.',
          })
        },
        onStatus: (status) => {
          setConnectionStatus(status)
          if (status === 'connected') setConnectionError('')
        },
        onError: (message) => setConnectionError(message),
      })

      setConnectionError('')
      channelRef.current = handle
    },
    [closeChannel, toast],
  )

  // Auto-connect on mount if a stored session exists.
  // Uses the StrictMode-safe ignored-flag + setTimeout(0) pattern to avoid
  // the double-connect race condition in development.
  useEffect(() => {
    const storedId = localStorage.getItem('pairing_session_id')
    if (!storedId) return

    let ignored = false

    const timer = setTimeout(() => {
      if (!ignored) openChannel(storedId)
    }, 0)

    return () => {
      ignored = true
      clearTimeout(timer)
      closeChannel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleOffline = () => setConnectionStatus('offline')
    const handleOnline = () => {
      if (sessionId) openChannel(sessionId)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [openChannel, sessionId])

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Call after creating a brand-new session (e.g. after disconnect) to wire
   * up a fresh channel and load history for the new session (always empty).
   */
  const reconnectSession = useCallback(
    (newSessionId) => {
      setDevices([])
      setConnected(false)
      previousConnectedRef.current = false
      setSharedItems(loadHistory(newSessionId)) // new session → []
      setSessionId(newSessionId)
      openChannel(newSessionId)
    },
    [openChannel],
  )

  /**
   * Explicitly disconnect the current session.
   *
   * Everything shared in it is destroyed: files are removed from Storage, the
   * session row is dropped so its id and QR stop working, and the local history
   * is cleared. Nothing the user sent is left behind.
   */
  const disconnectSession = useCallback(async () => {
    const currentId = localStorage.getItem('pairing_session_id')
    const handle = channelRef.current

    // Announce before tearing anything down, while the channel is still open,
    // so the other device can clear its now-dead file links.
    if (handle) await handle.announceEnd()

    closeChannel()

    clearHistory(currentId)
    localStorage.removeItem('pairing_session_id')

    setDevices([])
    setConnected(false)
    previousConnectedRef.current = false
    setConnectionError('')
    setConnectionStatus('idle')
    setSharedItems([])
    setSessionId('')

    await destroyPairingSession(currentId)
  }, [closeChannel])

  const sendMessagePayload = useCallback(async (payload) => {
    const handle = channelRef.current

    if (!handle) {
      throw userError('Not connected. Waiting for the other device.')
    }

    // realtime.service builds the canonical message (id, timestamp, sender),
    // so the local copy and the remote copy cannot drift apart.
    const sent = await handle.send(payload)

    setSharedItems((prev) => [{ ...sent, sender: 'You' }, ...prev])
  }, [])

  const sendText = useCallback(
    (text) => sendMessagePayload({ itemType: 'text', text }),
    [sendMessagePayload],
  )

  const sendLink = useCallback(
    (url, note = '') => sendMessagePayload({ itemType: 'link', url, text: note }),
    [sendMessagePayload],
  )

  const sendFile = useCallback(
    (fileMetaData) => sendMessagePayload({ itemType: 'file', ...fileMetaData }),
    [sendMessagePayload],
  )

  const clearSharedItems = useCallback(async () => {
    const currentId = localStorage.getItem('pairing_session_id')
    const handle = channelRef.current

    if (handle) await handle.clearActivity()

    clearHistory(currentId)
    setSharedItems([])
  }, [])

  const retryConnection = useCallback(() => {
    if (sessionId) openChannel(sessionId)
  }, [openChannel, sessionId])

  return (
    <DeviceContext.Provider
      value={{
        devices,
        connected,
        connectionStatus,
        connectionError,
        endedSignal,
        sharedItems,
        sessionId,
        sendMessagePayload,
        sendText,
        sendLink,
        sendFile,
        clearSharedItems,
        retryConnection,
        disconnectSession,
        reconnectSession,
      }}
    >
      {children}
    </DeviceContext.Provider>
  )
}

export const useDevice = () => {
  const context = useContext(DeviceContext)

  if (!context) {
    throw new Error('useDevice must be inside DeviceProvider')
  }

  return context
}
