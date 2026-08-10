import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  FiCheck,
  FiCopy,
  FiMonitor,
  FiPower,
  FiSmartphone,
  FiX,
} from 'react-icons/fi'

import { useAuth } from '../context/AuthContext.jsx'
import { useDevice } from '../context/DeviceContext.jsx'
import {
  createPairingSession,
  getPairingSession,
} from '../services/pairing.service.js'

import { AppHeader } from '../components/AppHeader.jsx'
import DeviceCard from '../components/DeviceCard.jsx'
import { ShareControls } from '../components/ShareControls.jsx'
import { SharedItemsList } from '../components/SharedItemsList.jsx'
import { getStoredDevice } from '../utils/device-session.js'

function formatExpiry(date) {
  try {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function DashboardPage() {
  const { user, logout } = useAuth()
  const {
    connected,
    devices,
    sharedItems,
    sendText,
    sendLink,
    sendFile,
    disconnectSession,
    reconnectSession,
  } = useDevice()

  const [session, setSession] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  const currentDevice = getStoredDevice()
  const otherDevices = devices.filter((d) => d.id !== currentDevice.id)
  const pairedDeviceName =
    otherDevices.length > 0 ? otherDevices[0].name : null

  useEffect(() => {
    const initSession = async () => {
      try {
        let existingId = localStorage.getItem('pairing_session_id')
        if (existingId) {
          try {
            const data = await getPairingSession(existingId)
            if (data && data.sessionId) {
              setSession(data)
              setLoadingSession(false)
              reconnectSession(data.sessionId)
              return
            }
          } catch {
            localStorage.removeItem('pairing_session_id')
          }
        }

        const newSession = await createPairingSession()
        localStorage.setItem('pairing_session_id', newSession.sessionId)
        setSession(newSession)
        reconnectSession(newSession.sessionId)
      } catch (err) {
        console.error('Failed to initialize pairing session:', err)
      } finally {
        setLoadingSession(false)
      }
    }

    initSession()
  }, [reconnectSession])

  const handleDisconnect = async () => {
    disconnectSession()
    setSession(null)
    try {
      const newSession = await createPairingSession()
      localStorage.setItem('pairing_session_id', newSession.sessionId)
      setSession(newSession)
      reconnectSession(newSession.sessionId)
    } catch (err) {
      console.error('Failed to create new session after disconnect:', err)
    }
  }

  const copySessionId = () => {
    if (!session?.sessionId) return
    navigator.clipboard.writeText(session.sessionId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const copyPairingUrl = () => {
    if (!pairingUrl) return
    navigator.clipboard.writeText(pairingUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const pairingUrl = session
    ? `${window.location.origin}/pair/${session.sessionId}`
    : ''

  const statusPill = (
    <div className="flex items-center gap-2 sm:gap-3">
      <span
        className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium ring-1 sm:px-3 sm:text-xs ${
          connected
             ? 'bg-primary-50 text-primary-dark ring-primary-100'
             : 'bg-ink-50 text-ink-600 ring-border'
        }`}
      >
        <span
           className={`status-dot ${connected ? 'bg-primary' : 'bg-ink-400'}`}
        />
        <span className="hidden sm:inline">
          {connected
            ? `Paired · ${pairedDeviceName || 'Device'}`
            : 'Waiting for pairing'}
        </span>
        <span className="sm:hidden">{connected ? 'Paired' : 'Waiting'}</span>
      </span>

      {connected && (
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
      <AppHeader statusNode={statusPill} user={user} onLogout={logout} />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="grid gap-5 lg:grid-cols-12 sm:gap-6">
          {/* Left: Share panel + activity */}
          <div className="space-y-5 lg:col-span-8 xl:col-span-7 sm:space-y-6">
            <ShareControls
              onSendText={sendText}
              onSendLink={sendLink}
              onSendFile={sendFile}
              disabled={!connected && otherDevices.length === 0}
            />

            <SharedItemsList items={sharedItems} />
          </div>

          {/* Right: QR + devices */}
          <aside className="space-y-5 lg:col-span-4 xl:col-span-5 sm:space-y-6">
            {/* QR Card */}
            <section className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-border-soft px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-ink-50 text-ink-600 ring-1 ring-inset ring-border">
                    <FiSmartphone size={17} />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-semibold text-ink-900">
                      Pair a device
                    </h2>
                    <p className="text-[12px] text-ink-500">
                      Scan QR or open the link
                    </p>
                  </div>
                </div>

                {/* Primary Copy Action = FULL URL */}
                <button
                  type="button"
                  onClick={copyPairingUrl}
                  disabled={!pairingUrl}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-primary-600 active:translate-y-px disabled:opacity-50 sm:px-3 sm:text-xs"
                  title="Copy full pairing link"
                >
                  {copiedUrl ? (
                    <>
                      <FiCheck size={12} className="text-primary-100" />
                      Copied
                    </>
                  ) : (
                    <>
                      <FiCopy size={12} />
                      Copy link
                    </>
                  )}
                </button>
              </div>

              <div className="px-5 py-6 sm:px-6 sm:py-7">
                <p className="mx-auto max-w-md text-center text-[13px] text-ink-500">
                  Open this link on your other device, or scan the QR code
                  below to pair instantly.
                </p>

                <div className="mt-6 flex flex-col items-center">
                  {loadingSession ? (
                    <div className="flex h-48 w-48 items-center justify-center rounded-md border border-dashed border-border bg-white">
                      <div className="flex flex-col items-center gap-2 text-ink-400">
                        <svg
                          className="h-5 w-5 animate-spin text-primary"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="3"
                            opacity="0.2"
                          />
                          <path
                            d="M12 2a10 10 0 0 1 10 10"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                        </svg>
                        <p className="text-[11px] font-medium">Generating QR…</p>
                      </div>
                    </div>
                  ) : session ? (
                    <div className="rounded-md border border-border bg-white p-4 shadow-sm sm:p-5">
                      <QRCodeSVG
                        value={pairingUrl}
                        size={170}
                        level="M"
                        fgColor="#0b1220"
                        bgColor="transparent"
                      />
                    </div>
                  ) : null}

                  {/* FULL pairing URL — the main thing people want to copy */}
                  {session && (
                    <div className="mt-6 w-full max-w-md">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                          Pairing URL
                        </p>
                        {session.expiresAt && (
                          <p className="text-[10px] font-medium text-ink-400">
                            Expires · {formatExpiry(session.expiresAt)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 rounded-md border border-border bg-ink-50 p-1.5">
                        <code className="min-w-0 flex-1 truncate px-2.5 mono text-[11px] font-medium text-ink-700 sm:text-xs">
                          {pairingUrl}
                        </code>
                        <button
                          type="button"
                          onClick={copyPairingUrl}
                          className="flex shrink-0 items-center gap-1.5 rounded-[5px] border border-border bg-white px-3 py-1.5 text-[11px] font-medium text-ink-700 transition hover:bg-ink-100 sm:text-xs"
                        >
                          {copiedUrl ? (
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

                  {/* Session ID (still visible, secondary) */}
                  {session && (
                    <div className="mt-4 w-full max-w-md">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                          Session code
                        </p>
                      </div>
                      <div className="flex items-center gap-2 rounded-md border border-border bg-white p-1.5">
                        <code className="min-w-0 flex-1 truncate px-2.5 text-center mono text-[12px] font-semibold text-ink-800 sm:text-[13px]">
                          {session.sessionId}
                        </code>
                        <button
                          type="button"
                          onClick={copySessionId}
                          className="flex shrink-0 items-center gap-1.5 rounded-[5px] border border-border bg-ink-50 px-3 py-1.5 text-[11px] font-medium text-ink-700 transition hover:bg-ink-100 sm:text-xs"
                          title="Copy session code only"
                        >
                          {copiedId ? (
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
                </div>

                {!session && !loadingSession && (
                   <div className="mt-6 flex items-center justify-center gap-2 rounded-md border border-primary-100 bg-primary-50 px-3 py-2 text-[12px] text-primary-dark">
                    <FiX size={14} />
                    Could not create a session. Refresh to try again.
                  </div>
                )}
              </div>
            </section>

            {/* Devices card */}
            <section className="surface">
              <div className="flex items-center justify-between border-b border-border-soft px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-ink-50 text-ink-600 ring-1 ring-inset ring-border">
                    <FiMonitor size={17} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-ink-900">
                      Connected devices
                    </h3>
                    <p className="text-[12px] text-ink-500">In this session</p>
                  </div>
                </div>
                <span className="badge bg-ink-50 text-ink-600 border border-border tabular-nums">
                  {devices.length} {devices.length === 1 ? 'device' : 'devices'}
                </span>
              </div>

              <div className="space-y-2.5 px-5 py-5 sm:px-6 sm:py-6 sm:space-y-3">
                <DeviceCard device={currentDevice} current />
                {otherDevices.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-border bg-ink-50 px-4 py-5 text-center sm:px-6 sm:py-6">
                    <p className="text-[13px] font-medium text-ink-700">
                      No other devices yet
                    </p>
                    <p className="mt-1 text-[12px] text-ink-500">
                      Share the pairing link or scan the QR code above.
                    </p>
                  </div>
                ) : (
                  otherDevices.map((d) => (
                    <DeviceCard key={d.id} device={d} />
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default DashboardPage
