import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  FiCheck,
  FiCopy,
  FiLogOut,
  FiMonitor,
  FiPower,
  FiRefreshCw,
  FiSmartphone,
} from 'react-icons/fi'

import { useAuth } from '../context/AuthContext.jsx'
import { useDevice } from '../context/DeviceContext.jsx'
import { createPairingSession, getPairingSession } from '../services/pairing.service.js'

import DeviceCard from '../components/DeviceCard.jsx'
import { ShareControls } from '../components/ShareControls.jsx'
import { SharedItemsList } from '../components/SharedItemsList.jsx'
import { getStoredDevice } from '../utils/device-session.js'

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
  const [copiedSession, setCopiedSession] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  const currentDevice = getStoredDevice()
  const otherDevices = devices.filter((d) => d.id !== currentDevice.id)

  // Initialize or fetch pairing session automatically
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
              return
            }
          } catch {
            localStorage.removeItem('pairing_session_id')
          }
        }

        const newSession = await createPairingSession()
        localStorage.setItem('pairing_session_id', newSession.sessionId)
        setSession(newSession)
      } catch (err) {
        console.error('Failed to initialize pairing session:', err)
      } finally {
        setLoadingSession(false)
      }
    }

    initSession()
  }, [])

  const handleDisconnect = async () => {
    disconnectSession()
    setSession(null)
    try {
      const newSession = await createPairingSession()
      localStorage.setItem('pairing_session_id', newSession.sessionId)
      setSession(newSession)
      // Re-open WebSocket for the fresh session
      reconnectSession(newSession.sessionId)
    } catch (err) {
      console.error('Failed to create new session after disconnect:', err)
    }
  }

  const copySessionId = () => {
    if (!session?.sessionId) return
    navigator.clipboard.writeText(session.sessionId)
    setCopiedSession(true)
    setTimeout(() => setCopiedSession(false), 2000)
  }

  const pairingUrl = session
    ? `${window.location.origin}/pair/${session.sessionId}`
    : ''

  const pairedDeviceName = otherDevices.length > 0
    ? otherDevices[0].name
    : null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm">
              F
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-slate-900 leading-none">
                FLY Bridge
              </h1>
              <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                Cross-device file & data transfer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Connection Status Badge */}
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100/80 px-3 py-1 text-xs font-medium text-slate-700">
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
              <span>
                {connected
                  ? `Paired with ${pairedDeviceName || 'Secondary Device'}`
                  : 'Waiting for pairing'}
              </span>
            </div>

            {/* Disconnect Option */}
            {connected && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/80 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                title="Disconnect Current Pairing"
              >
                <FiPower size={13} />
                <span className="hidden sm:inline">Disconnect</span>
              </button>
            )}

            {user && (
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
              >
                <FiLogOut size={14} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Share Panel & Feed (7 cols) */}
          <div className="space-y-6 lg:col-span-7">
            <ShareControls
              onSendText={sendText}
              onSendLink={sendLink}
              onSendFile={sendFile}
              disabled={!connected && otherDevices.length === 0}
            />

            <SharedItemsList items={sharedItems} />
          </div>

          {/* Right Column: QR Code & Device Status (5 cols) */}
          <div className="space-y-6 lg:col-span-5">
            {/* Pairing QR Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FiSmartphone className="text-slate-700" size={16} />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Pair Device
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400">Scan QR Code</span>
              </div>

              <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                Scan this code from your mobile browser camera to link devices.
              </p>

              {/* QR Display */}
              <div className="mt-4 flex flex-col items-center">
                {loadingSession ? (
                  <div className="flex h-44 w-44 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                    <p className="text-xs text-slate-400">Loading QR...</p>
                  </div>
                ) : session ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <QRCodeSVG value={pairingUrl} size={160} level="M" />
                  </div>
                ) : null}

                {/* Session ID */}
                {session && (
                  <div className="mt-4 w-full">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-center">
                      Session Code
                    </p>
                    <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
                      <code className="min-w-0 flex-1 px-2 text-center font-mono text-xs font-semibold text-slate-800 truncate">
                        {session.sessionId}
                      </code>
                      <button
                        type="button"
                        onClick={copySessionId}
                        className="flex shrink-0 items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition"
                      >
                        {copiedSession ? (
                          <>
                            <FiCheck size={13} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <FiCopy size={13} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Devices Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FiMonitor size={15} className="text-slate-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Session Devices
                  </h3>
                </div>
                <span className="text-xs font-semibold text-slate-700">
                  {devices.length} Connected
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                <DeviceCard device={currentDevice} current />
                {otherDevices.map((d) => (
                  <DeviceCard key={d.id} device={d} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default DashboardPage