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
import { deletePairingFile } from '../services/storage.service.js'
import { joinPairingChannel } from '../services/realtime.service.js'
import { getStoredDevice, renameStoredDevice } from '../utils/device-session.js'
import { randomUUID } from '../utils/browser.js'
import { addOrReplaceTransfer } from '../utils/transfer.js'
import { recordEvent } from '../services/telemetry.service.js'

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
  const [localDevice, setLocalDevice] = useState(() => getStoredDevice())
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
  const reconnectAttemptsRef = useRef(0)
  const recoveryNeededRef = useRef(true)
  const recoveringTransfersRef = useRef(false)

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

      const device = { ...getStoredDevice(), role: 'host' }

      const handle = joinPairingChannel({
        sessionId: sid,
        device: { ...device, type: device.type || 'desktop' },
        onDevices: (list) => {
          const nowConnected = list.length > 1
          setDevices(list)
          setConnected(nowConnected)

          if (nowConnected && !previousConnectedRef.current) {
            recordEvent('pairing_connected', { side: 'host' })
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
          setSharedItems((prev) => addOrReplaceTransfer(prev, payload))
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
        onDelivery: (id) => {
          setSharedItems((items) =>
            items.map((item) =>
              item.id === id ? { ...item, deliveryStatus: 'delivered' } : item,
            ),
          )
        },
        onRemoved: (id) => {
          setSharedItems((items) => items.filter((item) => item.id !== id))
          toast({ tone: 'info', title: 'A shared item was removed' })
        },
        onStatus: (status) => {
          setConnectionStatus(status)
          if (status === 'connected') {
            reconnectAttemptsRef.current = 0
            setConnectionError('')
          }
        },
        onError: (message) => {
          recordEvent('reconnect_failed', { side: 'host' })
          setConnectionError(message)
        },
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

  // Reconnect automatically with a capped exponential delay. Manual retry and
  // the browser online event still reconnect immediately.
  useEffect(() => {
    if (!sessionId || !navigator.onLine) return
    if (!['reconnecting', 'disconnected'].includes(connectionStatus)) return

    const attempt = reconnectAttemptsRef.current
    const delay = Math.min(1_000 * 2 ** attempt, 15_000)
    const timer = setTimeout(() => {
      reconnectAttemptsRef.current += 1
      openChannel(sessionId)
    }, delay)

    return () => clearTimeout(timer)
  }, [connectionStatus, openChannel, sessionId])

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

    const pending = {
      ...payload,
      id: payload.id || randomUUID(),
      sender: 'You',
      senderId: localDevice.id,
      timestamp: payload.timestamp || new Date().toISOString(),
      deliveryStatus: 'sending',
    }
    setSharedItems((items) => addOrReplaceTransfer(items, pending))

    try {
      const sent = await handle.send(pending)
      setSharedItems((items) =>
        items.map((item) =>
          item.id === pending.id
            ? { ...sent, sender: 'You', deliveryStatus: item.deliveryStatus === 'delivered' ? 'delivered' : 'sent' }
            : item,
        ),
      )
      return sent
    } catch (error) {
      setSharedItems((items) =>
        items.map((item) =>
          item.id === pending.id ? { ...item, deliveryStatus: 'failed' } : item,
        ),
      )
      throw error
    }
  }, [localDevice.id])

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

  const retrySharedItem = useCallback(async (itemId) => {
    const item = sharedItems.find((entry) => entry.id === itemId)
    const handle = channelRef.current
    if (!item || !handle) throw userError('Reconnect before retrying this transfer.')

    setSharedItems((items) => items.map((entry) =>
      entry.id === itemId ? { ...entry, deliveryStatus: 'sending' } : entry,
    ))

    try {
      await handle.send(item)
      setSharedItems((items) => items.map((entry) =>
        entry.id === itemId && entry.deliveryStatus !== 'delivered'
          ? { ...entry, deliveryStatus: 'sent' }
          : entry,
      ))
    } catch (error) {
      setSharedItems((items) => items.map((entry) =>
        entry.id === itemId ? { ...entry, deliveryStatus: 'failed' } : entry,
      ))
      throw error
    }
  }, [sharedItems])

  const removeSharedItem = useCallback(async (itemId) => {
    const item = sharedItems.find((entry) => entry.id === itemId)
    if (!item) return

    if (item.storagePath) await deletePairingFile(item.storagePath)
    if (channelRef.current) await channelRef.current.removeItem(itemId)
    setSharedItems((items) => items.filter((entry) => entry.id !== itemId))
  }, [sharedItems])

  const renameLocalDevice = useCallback(async (name) => {
    const updated = { ...renameStoredDevice(name), role: 'host' }
    setLocalDevice(updated)
    setDevices((list) => list.map((device) => device.id === updated.id ? updated : device))
    await channelRef.current?.updateDevice(updated)
    return updated
  }, [])

  const retryConnection = useCallback(() => {
    if (sessionId) openChannel(sessionId)
  }, [openChannel, sessionId])

  useEffect(() => {
    if (connectionStatus !== 'connected' || !connected) {
      recoveryNeededRef.current = true
      return
    }
    if (!recoveryNeededRef.current || recoveringTransfersRef.current) return

    const failed = sharedItems.filter(
      (item) => item.sender === 'You' && item.deliveryStatus === 'failed',
    )
    recoveryNeededRef.current = false
    if (!failed.length || !channelRef.current) return

    recoveringTransfersRef.current = true
    const recover = async () => {
      let recovered = 0
      for (const item of failed) {
        try {
          setSharedItems((items) => items.map((entry) =>
            entry.id === item.id ? { ...entry, deliveryStatus: 'sending' } : entry,
          ))
          await channelRef.current?.send(item)
          setSharedItems((items) => items.map((entry) =>
            entry.id === item.id && entry.deliveryStatus !== 'delivered'
              ? { ...entry, deliveryStatus: 'sent' }
              : entry,
          ))
          recovered += 1
        } catch {
          setSharedItems((items) => items.map((entry) =>
            entry.id === item.id ? { ...entry, deliveryStatus: 'failed' } : entry,
          ))
        }
      }

      if (recovered) {
        toast({ tone: 'success', title: `${recovered} queued ${recovered === 1 ? 'transfer' : 'transfers'} recovered` })
      }
      recoveringTransfersRef.current = false
    }

    recover()
  }, [connected, connectionStatus, sharedItems, toast])

  return (
    <DeviceContext.Provider
      value={{
        devices,
        localDevice,
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
        retrySharedItem,
        removeSharedItem,
        renameLocalDevice,
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
