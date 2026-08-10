import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FiAlertTriangle,
  FiCheck,
  FiCopy,
  FiMonitor,
  FiPower,
  FiRefreshCw,
  FiX,
} from 'react-icons/fi'

import { getDeviceInfo } from '../utils/device.js'
import { getPairingSession } from '../services/pairing.service.js'
import {
  connectWebSocket,
  sendDeviceMessage,
} from '../services/websocket.service.js'
import { useDevice } from '../context/DeviceContext.jsx'
import { AppHeader } from '../components/AppHeader.jsx'
import { ShareControls } from '../components/ShareControls.jsx'
import { SharedItemsList } from '../components/SharedItemsList.jsx'

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
  } catch {
    /* storage quota or private mode – ignore */
  }
}

function getOrCreateJoinDevice(sessionId) {
  const key = `join_device_${sessionId}`
  try {
    const stored = sessionStorage.getItem(key)
    if (stored) return JSON.parse(stored)
  } catch {
    /* ignore */
  }

  const base = getDeviceInfo()
  const joinDevice = {
    ...base,
    id: crypto.randomUUID(),
    name: `${base.name} (Guest)`,
  }

  try {
    sessionStorage.setItem(key, JSON.stringify(joinDevice))
  } catch {
    /* ignore */
  }

  return joinDevice
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-ink-800">
      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-primary text-white shadow-sm">
          <span className="text-[17px] font-bold">F</span>
        </div>
        <p className="mt-6 text-[15px] font-semibold text-ink-900">
          Connecting to session…
        </p>
        <p className="mt-2 text-[13px] text-ink-500">
          Handshaking with the sender&apos;s device.
        </p>
      </div>
    </main>
  )
}

function ErrorScreen({ error, sessionId }) {
  const [copied, setCopied] = useState(false)
  const copyId = () => {
    if (!sessionId) return
    navigator.clipboard.writeText(sessionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 text-ink-800">
      <section className="w-full max-w-md">
        <div className="surface p-6 sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary-50 text-primary-dark ring-1 ring-inset ring-primary-100">
            <FiAlertTriangle size={22} />
          </div>

          <h1 className="mt-6 text-lg font-semibold text-ink-900">
            Session unavailable
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-[13px] leading-6 text-ink-500">
            {error ||
              'This session may have expired or was closed. Ask the sender for a fresh QR code or link.'}
          </p>

          {sessionId && (
            <div className="mt-6 rounded-md border border-border bg-ink-50 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Session code
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate mono text-[12px] font-semibold text-ink-800">
                  {sessionId}
                </code>
                <button
                  type="button"
                  onClick={copyId}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-white px-3 py-1.5 text-[11px] font-medium text-ink-700 transition hover:bg-ink-50"
                >
                  {copied ? (
                    <>
                      <FiCheck size={12} className="text-primary" />
                      Copied
                    </>
                  ) : (
                    <>
                      <FiCopy size={12} />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-7 inline-flex items-center gap-2 rounded-md bg-ink-900 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-ink-800 active:translate-y-px"
          >
            <FiRefreshCw size={14} />
            <span>Try again</span>
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-400">
          Sessions expire for security.
        </p>
      </section>
    </main>
  )
}

const JoinPairingPage = () => {
  const { sessionId } = useParams()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const socketRef = useRef(null)
  const [receivedMessages, setReceivedMessages] = useState(() =>
    loadHistory(sessionId),
  )

  const [pairedDevices, setPairedDevices] = useState([])
  const [socketReady, setSocketReady] = useState(false)
  const [disconnected, setDisconnected] = useState(false)

  const hostConnected = pairedDevices.length >= 2
  const controlsDisabled = !socketReady || !hostConnected || disconnected

  const { disconnectSession } = useDevice()
  const navigate = useNavigate()

  // Load session
  useEffect(() => {
    const loadPairingSession = async () => {
      try {
        const pairingSession = await getPairingSession(sessionId)
        setSession(pairingSession)
      } catch (err) {
        console.error(err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadPairingSession()
  }, [sessionId])

  // Persist history
  useEffect(() => {
    if (!sessionId) return
    saveHistory(sessionId, receivedMessages)
  }, [receivedMessages, sessionId])

  const handleDisconnect = () => {
    const current = socketRef.current
    if (current) {
      current.removeEventListener('open', () => {})
      current.removeEventListener('message', () => {})
      current.close()
      socketRef.current = null
    }

    disconnectSession()
    setDisconnected(true)
    setSocketReady(false)
    setPairedDevices([])
  }

  // WebSocket connection
  useEffect(() => {
    if (!session?.sessionId || disconnected) return

    const joinDevice = getOrCreateJoinDevice(session.sessionId)

    let ignored = false
    let handleMessageRef = null
    let handleOpenRef = null
    const backendOrigin = session.backendOrigin || null

    const timer = setTimeout(() => {
      if (ignored) return

      const connection = connectWebSocket(
        session.sessionId,
        null,
        joinDevice,
        backendOrigin,
      )

      const handleOpen = () => setSocketReady(true)

      const handleMessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'pairing:devices') {
            setPairedDevices(data.devices || [])
            return
          }
          if (data.type === 'pairing:joined') {
            setSocketReady(true)
            return
          }
          if (data.type === 'pairing:ended') {
            setError(data.message || 'The host has ended the session')
            setSocketReady(false)
            setPairedDevices([])
            return
          }
          if (data.type === 'device:message' && data.payload) {
            setReceivedMessages((prev) => [data.payload, ...prev])
          }
        } catch (err) {
          console.error('Invalid WebSocket message:', err)
        }
      }

      handleOpenRef = handleOpen
      handleMessageRef = handleMessage
      connection.addEventListener('open', handleOpen)
      connection.addEventListener('message', handleMessage)
      socketRef.current = connection
    }, 0)

    return () => {
      ignored = true
      clearTimeout(timer)
      const current = socketRef.current
      if (current) {
        if (handleOpenRef) current.removeEventListener('open', handleOpenRef)
        if (handleMessageRef)
          current.removeEventListener('message', handleMessageRef)
        current.close()
        socketRef.current = null
        setSocketReady(false)
      }
    }
  }, [session?.sessionId, session?.backendOrigin, disconnected])

  const handleSendPayload = (payload) => {
    const currentSocket = socketRef.current
    if (!currentSocket) {
      setError('Not connected to the host yet.')
      return
    }

    try {
      sendDeviceMessage(currentSocket, payload)
      const sentItem = {
        ...payload,
        id:
          payload.id ||
          Date.now().toString() +
            Math.random().toString(36).substring(2, 7),
        sender: 'You',
        timestamp: payload.timestamp || new Date().toISOString(),
      }
      setReceivedMessages((prev) => [sentItem, ...prev])
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <LoadingScreen />
  if (error && !session)
    return <ErrorScreen error={error} sessionId={sessionId} />

  if (disconnected || (error && session)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-ink-800">
        <div className="w-full max-w-sm text-center">
          <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-ink-100 text-ink-600">
            <FiPower size={22} />
          </div>
          <p className="mt-6 text-[15px] font-semibold text-ink-900">
            Disconnected
          </p>
          <p className="mt-2 text-[13px] text-ink-500">
            {error || 'You have left this session.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-ink-900 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-ink-800"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  const hostDevice = pairedDevices.find(
    (d) => d.name && !d.name.includes('Guest'),
  )

  // Same navbar pill structure as Dashboard
  const statusPill = (
    <div className="flex items-center gap-2 sm:gap-3">
      <span
        className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium ring-1 sm:px-3 sm:text-xs ${
          hostConnected
            ? 'bg-primary-50 text-primary-dark ring-primary-100'
            : socketReady
              ? 'bg-ink-50 text-ink-600 ring-border'
              : 'bg-ink-50 text-ink-500 ring-border'
        }`}
      >
        <span
          className={`status-dot ${
            hostConnected
              ? 'bg-primary'
              : socketReady
                ? 'bg-ink-400'
                : 'bg-ink-400'
          }`}
        />
        <FiMonitor size={13} className="hidden sm:inline" />
        <span className="hidden sm:inline">
          {hostConnected
            ? `Connected to ${hostDevice?.name || 'host'}`
            : socketReady
              ? 'Waiting for host…'
              : 'Connecting…'}
        </span>
        <span className="sm:hidden">
          {hostConnected ? 'Live' : socketReady ? 'Waiting' : '…'}
        </span>
      </span>

      {hostConnected && !disconnected && (
        <button
          type="button"
          onClick={handleDisconnect}
          className="flex items-center gap-1.5 rounded-md border border-border bg-ink-50 px-2.5 py-2 text-[11px] font-medium text-ink-600 transition hover:bg-ink-100 sm:px-3 sm:text-xs"
          title="Disconnect"
        >
          <FiPower size={13} />
          <span className="hidden sm:inline">Disconnect</span>
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-ink-50 text-ink-800">
      <AppHeader statusNode={statusPill} />

      {/* Transient error */}
      {error && session && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
           <div className="mt-3 flex items-start gap-2 rounded-md border border-primary-100 bg-primary-50 px-3.5 py-2.5 text-[12px] text-primary-dark shadow-sm">
            <FiAlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p className="flex-1 font-medium">{error}</p>
            <button
              type="button"
              onClick={() => setError('')}
               className="text-primary-600 transition hover:text-primary-dark"
              aria-label="Dismiss"
            >
              <FiX size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Main: 2-column on md+ — much wider container */}
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="grid gap-5 md:grid-cols-12 md:gap-6 sm:gap-6">
          {/* Left: Share Controls (sticky-ish on laptop) */}
          <section className="md:col-span-5 lg:col-span-4">
            <div className="md:sticky md:top-[calc(64px+1.5rem)] md:space-y-4">
              {!hostConnected && (
                <div className="mb-4 rounded-md border border-border bg-ink-50 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-ink-600 ring-1 ring-inset ring-border">
                      <FiRefreshCw size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[13px] font-semibold text-ink-900 sm:text-sm">
                        {socketReady
                          ? 'Waiting for host device'
                          : 'Opening connection…'}
                      </h2>
                      <p className="mt-1 text-[12px] leading-5 text-ink-500">
                        Keep the sender&apos;s dashboard open. History will load
                        automatically once paired.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-[11px] font-medium text-ink-700 transition hover:bg-ink-50 sm:text-xs"
                    >
                      <FiRefreshCw size={12} />
                      Reconnect
                    </button>
                  </div>
                </div>
              )}

              <ShareControls
                onSendText={(text) => handleSendPayload({ itemType: 'text', text })}
                onSendLink={(url, text) =>
                  handleSendPayload({ itemType: 'link', url, text })
                }
                onSendFile={(fileData) =>
                  handleSendPayload({ itemType: 'file', ...fileData })
                }
                disabled={controlsDisabled}
              />
            </div>
          </section>

          {/* Right: Activity Feed — uses 7/8 columns, much more space */}
          <section className="md:col-span-7 lg:col-span-8">
            <SharedItemsList items={receivedMessages} />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-2 text-center sm:px-6">
        <p className="text-[11px] text-ink-400">
          Session code ·{' '}
          <code className="mono">{session?.sessionId || sessionId}</code>
        </p>
      </footer>
    </div>
  )
}

export default JoinPairingPage
