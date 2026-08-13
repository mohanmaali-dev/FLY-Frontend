import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiAlertTriangle, FiPower } from 'react-icons/fi'
import { LuQrCode } from 'react-icons/lu'

import { randomUUID } from '../utils/browser.js'
import { toUserMessage, userError } from '../utils/errors.js'
import { addOrReplaceTransfer } from '../utils/transfer.js'
import { recordEvent } from '../services/telemetry.service.js'
import { getDeviceInfo } from '../utils/device.js'
import { deletePairingFile } from '../services/storage.service.js'
import {
  destroyPairingSession,
  resolvePairingSession,
} from '../services/pairing.service.js'
import { joinPairingChannel } from '../services/realtime.service.js'
import AppHeader from '../components/AppHeader.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Footer from '../components/Footer.jsx'
import { LogoMark } from '../components/Logo.jsx'
import SharingWorkspace from '../components/SharingWorkspace.jsx'
import { useToast } from '../components/Toast.jsx'

const formatBytes = (bytes) => {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${parseFloat((bytes / 1024 ** index).toFixed(1))} ${units[index]}`
}

const START_BUTTON =
  'mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-button)] transition active:scale-[0.98] hover:bg-accent-hover sm:w-auto sm:px-6'

/**
 * Wrapper for the loading / ended / error screens.
 *
 * These previously rendered a bare centred <main>, so disconnecting left the
 * user staring at a message with no header and no way to start again.
 */
function StatusShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 justify-center px-4 py-16 sm:px-6 sm:py-24">
        <div className="w-full max-w-sm text-center">{children}</div>
      </main>
      <Footer />
    </div>
  )
}

// Kept in localStorage, under a key distinct from the host's, so the guest's
// feed survives a refresh — a phone browser reloads far more readily than a
// desktop one — without the two colliding when both sides are the same browser.
const HISTORY_KEY = (sid) => `pairing_guest_history_${sid}`

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
  } catch { /* quota or private mode – ignore */ }
}

function clearHistory(sid) {
  if (!sid) return
  try {
    localStorage.removeItem(HISTORY_KEY(sid))
  } catch { /* ignore */ }
}

/**
 * Returns a stable, session-scoped device object for the joining side.
 *
 * Stored in sessionStorage (not localStorage) so:
 *  - Each browser tab has its own identity → no clash with the host tab
 *  - Refreshing the page reuses the same ID → clean reconnect
 */
function getOrCreateJoinDevice(sessionId) {
  const key = `join_device_${sessionId}`
  try {
    const stored = sessionStorage.getItem(key)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }

  const base = getDeviceInfo()
  const joinDevice = {
    ...base,
    // Give it a fresh UUID so it never equals the host's localStorage device
    id: randomUUID(),
    joinedAt: Date.now(),
    name: `${base.name} (Guest)`,
    role: 'guest',
  }

  try {
    sessionStorage.setItem(key, JSON.stringify(joinDevice))
  } catch { /* ignore */ }

  return joinDevice
}

const JoinPairingPage = () => {
  const { sessionId } = useParams()
  const { toast } = useToast()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [devices, setDevices] = useState([])
  const [ended, setEnded] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(
    navigator.onLine ? 'connecting' : 'offline',
  )
  const [reconnectToken, setReconnectToken] = useState(0)
  const [deviceRevision, setDeviceRevision] = useState(0)
  const [sessionFull, setSessionFull] = useState(false)

  // Loaded synchronously from the id in the URL so the feed is populated on the
  // very first render and the save effect below cannot clobber it.
  const [receivedMessages, setReceivedMessages] = useState(() => loadHistory(sessionId))

  const channelRef = useRef(null)
  const previousPairedRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const recoveryNeededRef = useRef(true)
  const recoveringTransfersRef = useRef(false)

  // Hoisted out of the connect effect so the render can tell our own device
  // apart from the host's when listing who is on the session.
  const joinDevice = useMemo(
    () => {
      // The revision changes after a rename, causing this sessionStorage-backed
      // value to be read again without giving the device a new identity.
      void deviceRevision
      return session?.sessionId ? getOrCreateJoinDevice(session.sessionId) : null
    },
    [session?.sessionId, deviceRevision],
  )

  const otherDevices = devices.filter((device) => device.id !== joinDevice?.id)
  const paired = otherDevices.length > 0
  const hostDevice = otherDevices[0] || null

  useEffect(() => {
    if (!sessionId || ended) return
    saveHistory(sessionId, receivedMessages)
  }, [sessionId, receivedMessages, ended])

  // ── Load session ───────────────────────────────────────────────────────────
  useEffect(() => {
    const loadPairingSession = async () => {
      try {
        // The route param may be a short code or a full session id.
        const pairingSession = await resolvePairingSession(sessionId)
        setSession(pairingSession)
      } catch (err) {
        setError(toUserMessage(err))
      } finally {
        setLoading(false)
      }
    }

    loadPairingSession()
  }, [sessionId])

  // ── Realtime connection ────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.sessionId || !joinDevice) return

    let ignored = false

    // Small deferral to avoid the StrictMode double-connect race condition
    const timer = setTimeout(() => {
      if (ignored) return

      channelRef.current = joinPairingChannel({
        sessionId: session.sessionId,
        device: joinDevice,
        onDevices: (list) => {
          const admitted = list.some((entry) => entry.id === joinDevice.id)
          if (!admitted && list.length >= 2) {
            setSessionFull(true)
            setDevices([])
            return
          }

          setSessionFull(false)
          const nowPaired = list.length > 1
          setDevices(list)
          if (nowPaired && !previousPairedRef.current) {
            recordEvent('pairing_connected', { side: 'guest' })
            const peer = list.find((entry) => entry.id !== joinDevice.id)
            toast({
              tone: 'success',
              title: 'Device connected',
              description: peer?.name || 'Both devices are ready to share.',
            })
          }
          previousPairedRef.current = nowPaired
        },
        onFull: () => {
          setSessionFull(true)
          setDevices([])
        },
        onMessage: (payload) => {
          setReceivedMessages((current) => addOrReplaceTransfer(current, payload))
          toast({
            tone: 'info',
            title: 'New transfer received',
            description: payload.fileName || payload.text || payload.url || 'Open recent transfers to view it.',
          })
        },
        onEnded: (by) => {
          // Files are already deleted on the server; holding the links would
          // just show broken downloads.
          clearHistory(session.sessionId)
          setReceivedMessages([])
          setDevices([])
          previousPairedRef.current = false
          setEnded(`${by} ended the session. Everything shared was deleted.`)
        },
        onCleared: () => {
          clearHistory(session.sessionId)
          setReceivedMessages([])
        },
        onDelivery: (id) => {
          setReceivedMessages((items) => items.map((item) =>
            item.id === id ? { ...item, deliveryStatus: 'delivered' } : item,
          ))
        },
        onRemoved: (id) => {
          setReceivedMessages((items) => items.filter((item) => item.id !== id))
          toast({ tone: 'info', title: 'A shared item was removed' })
        },
        onStatus: (status) => {
          setConnectionStatus(status)
          if (status === 'connected') {
            reconnectAttemptsRef.current = 0
            setError('')
          }
        },
        onError: (message) => {
          recordEvent('reconnect_failed', { side: 'guest' })
          setError(message)
        },
      })
    }, 0)

    return () => {
      ignored = true
      clearTimeout(timer)

      const handle = channelRef.current
      channelRef.current = null
      handle?.close().catch(() => {})

      setDevices([])
      previousPairedRef.current = false
    }
  }, [session?.sessionId, joinDevice, reconnectToken, toast])

  useEffect(() => {
    const handleOffline = () => setConnectionStatus('offline')
    const handleOnline = () => setReconnectToken((value) => value + 1)

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  useEffect(() => {
    if (!session?.sessionId || !navigator.onLine) return
    if (!['reconnecting', 'disconnected'].includes(connectionStatus)) return

    const delay = Math.min(1_000 * 2 ** reconnectAttemptsRef.current, 15_000)
    const timer = setTimeout(() => {
      reconnectAttemptsRef.current += 1
      setReconnectToken((value) => value + 1)
    }, delay)
    return () => clearTimeout(timer)
  }, [connectionStatus, session?.sessionId])

  useEffect(() => {
    if (!session?.sessionId || ended) return

    const timer = setInterval(async () => {
      try {
        setSession(await resolvePairingSession(session.sessionId))
      } catch {
        clearHistory(session.sessionId)
        setReceivedMessages([])
        setEnded('This session expired. Start a new session to continue sharing.')
      }
    }, 60_000)

    return () => clearInterval(timer)
  }, [ended, session?.sessionId])

  // ── Send ───────────────────────────────────────────────────────────────────
  // Rejections bubble to ShareControls, which shows them next to the form.
  // Routing them into `error` would replace the page with the fatal screen.
  const handleSendPayload = async (payload) => {
    const handle = channelRef.current

    if (!handle) {
      throw userError('Not connected yet. Waiting for the other device.')
    }

    const pending = {
      ...payload,
      id: payload.id || randomUUID(),
      sender: 'You',
      senderId: joinDevice.id,
      timestamp: payload.timestamp || new Date().toISOString(),
      deliveryStatus: 'sending',
    }
    setReceivedMessages((items) => addOrReplaceTransfer(items, pending))

    try {
      const sent = await handle.send(pending)
      setReceivedMessages((items) => items.map((item) =>
        item.id === pending.id
          ? { ...sent, sender: 'You', deliveryStatus: item.deliveryStatus === 'delivered' ? 'delivered' : 'sent' }
          : item,
      ))
      return sent
    } catch (sendError) {
      setReceivedMessages((items) => items.map((item) =>
        item.id === pending.id ? { ...item, deliveryStatus: 'failed' } : item,
      ))
      throw sendError
    }
  }

  const handleRetryItem = async (itemId) => {
    const item = receivedMessages.find((entry) => entry.id === itemId)
    const handle = channelRef.current
    if (!item || !handle) throw userError('Reconnect before retrying this transfer.')

    setReceivedMessages((items) => items.map((entry) =>
      entry.id === itemId ? { ...entry, deliveryStatus: 'sending' } : entry,
    ))
    try {
      await handle.send(item)
      setReceivedMessages((items) => items.map((entry) =>
        entry.id === itemId && entry.deliveryStatus !== 'delivered'
          ? { ...entry, deliveryStatus: 'sent' }
          : entry,
      ))
    } catch (retryError) {
      setReceivedMessages((items) => items.map((entry) =>
        entry.id === itemId ? { ...entry, deliveryStatus: 'failed' } : entry,
      ))
      throw retryError
    }
  }

  const handleRemoveItem = async (itemId) => {
    const item = receivedMessages.find((entry) => entry.id === itemId)
    if (!item) return
    if (item.storagePath) await deletePairingFile(item.storagePath)
    if (channelRef.current) await channelRef.current.removeItem(itemId)
    setReceivedMessages((items) => items.filter((entry) => entry.id !== itemId))
  }

  const handleRenameDevice = async (name) => {
    const nextName = name.trim().replace(/\s+/g, ' ').slice(0, 48)
    if (nextName.length < 2) throw userError('Use at least 2 characters for the device name.')
    const updated = { ...joinDevice, name: nextName }
    sessionStorage.setItem(`join_device_${session.sessionId}`, JSON.stringify(updated))
    await channelRef.current?.updateDevice(updated)
    setDevices((list) => list.map((device) => device.id === updated.id ? updated : device))
    setDeviceRevision((value) => value + 1)
  }

  useEffect(() => {
    if (connectionStatus !== 'connected' || !paired) {
      recoveryNeededRef.current = true
      return
    }
    if (!recoveryNeededRef.current || recoveringTransfersRef.current) return

    const failed = receivedMessages.filter(
      (item) => item.sender === 'You' && item.deliveryStatus === 'failed',
    )
    recoveryNeededRef.current = false
    if (!failed.length || !channelRef.current) return

    recoveringTransfersRef.current = true
    const recover = async () => {
      let recovered = 0
      for (const item of failed) {
        try {
          setReceivedMessages((items) => items.map((entry) =>
            entry.id === item.id ? { ...entry, deliveryStatus: 'sending' } : entry,
          ))
          await channelRef.current?.send(item)
          setReceivedMessages((items) => items.map((entry) =>
            entry.id === item.id && entry.deliveryStatus !== 'delivered'
              ? { ...entry, deliveryStatus: 'sent' }
              : entry,
          ))
          recovered += 1
        } catch {
          setReceivedMessages((items) => items.map((entry) =>
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
  }, [connectionStatus, paired, receivedMessages, toast])

  const handleClearActivity = async () => {
    const handle = channelRef.current
    if (handle) await handle.clearActivity()

    clearHistory(session?.sessionId)
    setReceivedMessages([])
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    if (disconnecting) return

    setDisconnecting(true)

    try {
      const handle = channelRef.current

      // Announce while the channel is still open, so the host clears the links
      // to files that are about to be deleted.
      if (handle) await handle.announceEnd()

      channelRef.current = null
      await handle?.close().catch(() => {})

      clearHistory(session?.sessionId)
      setReceivedMessages([])
      setDevices([])
      setEnded('You ended the session. Everything shared was deleted.')

      await destroyPairingSession(session?.sessionId)
    } finally {
      setDisconnecting(false)
      setConfirmingDisconnect(false)
    }
  }

  const sharedFileCount = receivedMessages.filter((item) => item.fileUrl).length

  const transferredBytes = receivedMessages.reduce(
    (total, item) => total + (item.fileSize || 0),
    0,
  )

  const connectionSummary = receivedMessages.length
    ? `${receivedMessages.length} shared${transferredBytes ? ` · ${formatBytes(transferredBytes)}` : ''}`
    : `Connected to ${hostDevice?.name || 'the other device'}`

  const disconnectConsequences = [
    sharedFileCount > 0
      ? `${sharedFileCount} shared ${sharedFileCount === 1 ? 'file' : 'files'} will be deleted for good.`
      : 'Any shared files will be deleted for good.',
    'This activity feed will be cleared on both devices.',
    'The other device will be disconnected and this link will stop working.',
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <StatusShell>
        <LogoMark size="lg" className="mx-auto animate-pulse" />
        <p className="mt-4 text-sm font-medium text-ink-soft">
          Connecting to session...
        </p>
      </StatusShell>
    )
  }

  if (ended) {
    return (
      <StatusShell>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line text-ink-mute">
          <FiPower size={20} />
        </div>

        <h1 className="mt-6 text-xl font-semibold tracking-tight">Session ended</h1>

        <p className="mt-3 text-base leading-relaxed text-ink-soft">{ended}</p>

        <Link to="/" className={START_BUTTON}>
          <LuQrCode size={16} />
          Start a new session
        </Link>

        <p className="mt-4 text-sm text-ink-mute">
          Or scan a new code from the other device.
        </p>
      </StatusShell>
    )
  }

  if (sessionFull) {
    return (
      <StatusShell>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-warn-soft text-warn">
          <FiAlertTriangle size={20} />
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Session already full</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          FLY allows two devices per session. Ask one device to disconnect, or start a separate session.
        </p>
        <Link to="/" className={START_BUTTON}>
          <LuQrCode size={16} />
          Start another session
        </Link>
      </StatusShell>
    )
  }

  if (error && !session) {
    return (
      <StatusShell>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-warn-soft text-warn">
          <FiAlertTriangle size={20} />
        </div>

        <h1 className="mt-6 text-xl font-semibold tracking-tight">
          Session unavailable
        </h1>

        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          {error || 'This pairing session may have expired or is invalid.'}
        </p>

        <Link to="/" className={START_BUTTON}>
          <LuQrCode size={16} />
          Start a new session
        </Link>
      </StatusShell>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      {/* Same structure and widths as the host, so the two sides read as one
          product rather than a desktop app and a separate mobile page. */}
      <AppHeader>
        <span
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-[var(--shadow-card)] ${
            ['offline', 'reconnecting', 'disconnected'].includes(connectionStatus)
              ? 'border-danger-line bg-danger-soft text-danger'
              : paired
              ? 'border-ok-line bg-ok-soft text-ok'
              : 'border-warn-line bg-warn-soft text-warn'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              ['offline', 'reconnecting', 'disconnected'].includes(connectionStatus)
                ? 'bg-danger'
                : paired
                  ? 'bg-ok'
                  : 'animate-pulse bg-warn'
            }`}
          />
          {['offline', 'reconnecting', 'disconnected'].includes(connectionStatus)
            ? 'Reconnecting'
            : paired
              ? 'Connected'
              : 'Waiting'}
        </span>
      </AppHeader>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <SharingWorkspace
          localDevice={joinDevice}
          remoteDevice={hostDevice}
          paired={paired}
          summary={connectionSummary}
          items={receivedMessages}
          sessionId={session?.sessionId}
          expiresAt={session?.expiresAt}
          error={error}
          connectionStatus={connectionStatus}
          disabled={!paired}
          disabledReason="Waiting for the other device to come online. Sharing turns on automatically."
          onSendText={(text) => handleSendPayload({ itemType: 'text', text })}
          onSendLink={(url, text) => handleSendPayload({ itemType: 'link', url, text })}
          onSendFile={(fileData) => handleSendPayload({ itemType: 'file', ...fileData })}
          onClearActivity={handleClearActivity}
          onRetryItem={handleRetryItem}
          onRemoveItem={handleRemoveItem}
          onRenameDevice={handleRenameDevice}
          onRetryConnection={() => setReconnectToken((value) => value + 1)}
          onDisconnect={() => setConfirmingDisconnect(true)}
          disconnecting={disconnecting}
        />
      </main>

      {/* Compact: a live session on a phone does not need the brand blurb. */}
      <Footer compact />

      <ConfirmDialog
        open={confirmingDisconnect}
        title="End this session?"
        description="This cannot be undone."
        consequences={disconnectConsequences}
        confirmLabel="End session"
        cancelLabel="Keep session"
        busy={disconnecting}
        busyLabel="Deleting..."
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmingDisconnect(false)}
      />
    </div>
  )
}

export default JoinPairingPage
