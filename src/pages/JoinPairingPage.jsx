import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  FiMonitor,
} from 'react-icons/fi'

import { getDeviceInfo } from '../utils/device.js'
import { getPairingSession } from '../services/pairing.service.js'
import {
  connectWebSocket,
  sendDeviceMessage,
} from '../services/websocket.service.js'
import { ShareControls } from '../components/ShareControls.jsx'
import { SharedItemsList } from '../components/SharedItemsList.jsx'

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
    id: crypto.randomUUID(),
    name: `${base.name} (Guest)`,
  }

  try {
    sessionStorage.setItem(key, JSON.stringify(joinDevice))
  } catch { /* ignore */ }

  return joinDevice
}

const JoinPairingPage = () => {
  const { sessionId } = useParams()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [socket, setSocket] = useState(null)
  const [receivedMessages, setReceivedMessages] = useState([])

  // ── Load session ───────────────────────────────────────────────────────────
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

  // ── WebSocket connection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.sessionId) return

    // Build a unique joining device (fresh UUID, sessionStorage-backed)
    const joinDevice = getOrCreateJoinDevice(session.sessionId)

    let ignored = false

    // Small deferral to avoid StrictMode double-connect race condition
    const timer = setTimeout(() => {
      if (ignored) return

      const connection = connectWebSocket(
        session.sessionId,
        null,       // type is already set inside joinDevice
        joinDevice, // pass the full device override
      )

      setSocket(connection)

      const handleMessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'device:message' && data.payload) {
            setReceivedMessages((currentMessages) => [
              data.payload,
              ...currentMessages,
            ])
          }
        } catch (err) {
          console.error('Invalid WebSocket message:', err)
        }
      }

      connection.addEventListener('message', handleMessage)

      // Keep a ref-like reference so cleanup can close it
      connection._handleMessage = handleMessage
      setSocket(connection)
    }, 0)

    return () => {
      ignored = true
      clearTimeout(timer)
      setSocket((prev) => {
        if (prev) {
          if (prev._handleMessage) {
            prev.removeEventListener('message', prev._handleMessage)
          }
          prev.close()
        }
        return null
      })
    }
  }, [session?.sessionId])

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSendPayload = (payload) => {
    if (!socket) return

    try {
      sendDeviceMessage(socket, payload)
      const sentItem = {
        ...payload,
        id:
          payload.id ||
          Date.now().toString() + Math.random().toString(36).substring(2, 7),
        sender: 'You',
        timestamp: payload.timestamp || new Date().toISOString(),
      }
      setReceivedMessages((prev) => [sentItem, ...prev])
    } catch (err) {
      setError(err.message)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-ink">
        <div className="text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white font-bold text-xl mx-auto shadow-sm animate-pulse">
            ✈
          </div>
          <p className="text-sm font-semibold text-ink/70">
            Connecting to session...
          </p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-ink">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 font-bold text-xl">
            !
          </div>

          <h1 className="mt-6 text-xl font-bold text-ink">
            Pairing Session Unavailable
          </h1>

          <p className="mt-2 text-xs leading-relaxed text-ink/60">
            {error || 'This pairing session may have expired or is invalid.'}
          </p>
        </section>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-ink antialiased">
      {/* Mobile Sticky Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white font-bold text-base shadow-sm">
              ✈
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-ink leading-none">FLY Mobile</span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-800">
                  PAIRED
                </span>
              </div>
            </div>
          </div>

          {/* Connection status indicator */}
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <FiMonitor size={13} />
            <span>Connected to Host</span>
          </div>
        </div>
      </header>

      {/* Main Mobile Content Area */}
      <main className="mx-auto max-w-xl px-4 py-5 space-y-5">
        {/* Mobile Share Controls */}
        <ShareControls
          onSendText={(text) => handleSendPayload({ itemType: 'text', text })}
          onSendLink={(url, text) => handleSendPayload({ itemType: 'link', url, text })}
          onSendFile={(fileData) => handleSendPayload({ itemType: 'file', ...fileData })}
        />

        {/* Mobile Shared Activity Feed */}
        <SharedItemsList items={receivedMessages} />
      </main>
    </div>
  )
}

export default JoinPairingPage