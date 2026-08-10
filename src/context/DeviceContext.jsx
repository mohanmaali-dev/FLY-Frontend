import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  connectWebSocket,
  sendDeviceMessage,
} from '../services/websocket.service.js'

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

  // Load history SYNCHRONOUSLY in the state initializer so it's available
  // on the very first render and is never overwritten by the save effect
  // before the load effect can run (the StrictMode race condition).
  const [sharedItems, setSharedItems] = useState(
    () => loadHistory(localStorage.getItem('pairing_session_id') || ''),
  )

  // Keep the socket in a ref so callbacks always see the latest value without
  // needing to be declared as dependencies.
  const socketRef = useRef(null)

  // ── Persist history whenever items change ─────────────────────────────────
  // We skip saving when sharedItems is the empty initial state AND sessionId
  // is empty (nothing to save). The synchronous load above ensures we don't
  // overwrite stored data on mount.
  useEffect(() => {
    if (!sessionId) return
    saveHistory(sessionId, sharedItems)
  }, [sharedItems, sessionId])

  // ── WebSocket helpers ─────────────────────────────────────────────────────

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data)

      if (data.type === 'pairing:devices') {
        setDevices(data.devices || [])
        setConnected((data.devices || []).length > 1)
        return
      }

      if (data.type === 'device:message' && data.payload) {
        setSharedItems((prev) => [data.payload, ...prev])
      }
    } catch {
      /* ignore malformed messages */
    }
  }, [])

  const openSocket = useCallback(
    (sid) => {
      // Close any stale socket first
      if (socketRef.current) {
        socketRef.current.removeEventListener('message', handleMessage)
        socketRef.current.close()
        socketRef.current = null
      }

      if (!sid) return

      const connection = connectWebSocket(sid, 'desktop')
      connection.addEventListener('message', handleMessage)
      socketRef.current = connection
    },
    [handleMessage],
  )

  // Auto-connect on mount if a stored session exists.
  // Uses the StrictMode-safe ignored-flag + setTimeout(0) pattern to avoid
  // the double-connect race condition in development.
  useEffect(() => {
    const storedId = localStorage.getItem('pairing_session_id')
    if (!storedId) return

    let ignored = false

    const timer = setTimeout(() => {
      if (!ignored) openSocket(storedId)
    }, 0)

    return () => {
      ignored = true
      clearTimeout(timer)
      if (socketRef.current) {
        socketRef.current.removeEventListener('message', handleMessage)
        socketRef.current.close()
        socketRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Call after creating a brand-new session (e.g. after disconnect) to wire
   * up a fresh WebSocket and load history for the new session (always empty).
   */
  const reconnectSession = useCallback(
    (newSessionId) => {
      setDevices([])
      setConnected(false)
      setSharedItems(loadHistory(newSessionId)) // new session → []
      setSessionId(newSessionId)
      openSocket(newSessionId)
    },
    [openSocket],
  )

  /**
   * Explicitly disconnect the current session.
   * Clears history from localStorage so the next fresh session starts clean.
   */
  const disconnectSession = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeEventListener('message', handleMessage)
      socketRef.current.close()
      socketRef.current = null
    }

    const currentId = localStorage.getItem('pairing_session_id')
    clearHistory(currentId)
    localStorage.removeItem('pairing_session_id')

    setDevices([])
    setConnected(false)
    setSharedItems([])
    setSessionId('')
  }, [handleMessage])

  const sendMessagePayload = useCallback((payload) => {
    sendDeviceMessage(socketRef.current, payload)
    const sentItem = {
      ...payload,
      id:
        payload.id ||
        Date.now().toString() + Math.random().toString(36).substring(2, 7),
      sender: 'You',
      timestamp: payload.timestamp || new Date().toISOString(),
    }
    setSharedItems((prev) => [sentItem, ...prev])
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

  return (
    <DeviceContext.Provider
      value={{
        devices,
        connected,
        sharedItems,
        sessionId,
        sendMessagePayload,
        sendText,
        sendLink,
        sendFile,
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