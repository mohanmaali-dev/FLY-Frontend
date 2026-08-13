import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  FiArrowRight,
  FiCheck,
  FiCopy,
  FiFile,
  FiFileText,
  FiKey,
  FiLink,
  FiMonitor,
  FiShield,
  FiShare2,
  FiSmartphone,
  FiTablet,
} from 'react-icons/fi'

import { useDevice } from '../context/DeviceContext.jsx'
import {
  createPairingSession,
  formatCode,
  getPairingSession,
  getPairingSessionByCode,
  normaliseCode,
} from '../services/pairing.service.js'

import AppHeader from '../components/AppHeader.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Footer from '../components/Footer.jsx'
import SharingWorkspace from '../components/SharingWorkspace.jsx'
import { useToast } from '../components/Toast.jsx'
import { copyText } from '../utils/browser.js'

const CAPABILITIES = [
  { icon: FiFileText, label: 'Text & notes', mobileLabel: 'Text' },
  { icon: FiLink, label: 'Links', mobileLabel: 'Links' },
  { icon: FiFile, label: 'Photos & files', mobileLabel: 'Files' },
]

// Matches the device types used by the live sharing workspace.
const DEVICE_ICONS = {
  mobile: FiSmartphone,
  tablet: FiTablet,
  desktop: FiMonitor,
}

function DeviceTypeIcon({ type }) {
  const Icon = DEVICE_ICONS[type] || FiMonitor
  return <Icon size={13} className="shrink-0" aria-hidden="true" />
}

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${parseFloat((bytes / 1024 ** index).toFixed(1))} ${units[index]}`
}

const STEPS = [
  {
    title: 'Open your camera',
    body: 'Any phone camera or QR reader works. No app to install.',
  },
  {
    title: 'Scan the code',
    body: 'Your phone opens this session. Approve it here to connect.',
  },
  {
    title: 'Send anything',
    body: 'Text, links and files move instantly, in either direction.',
  },
]

function PairingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const {
    connectionError,
    connectionStatus,
    pendingDevice,
    endedSignal,
    devices,
    localDevice,
    sharedItems,
    sendText,
    sendLink,
    sendFile,
    clearSharedItems,
    retrySharedItem,
    removeSharedItem,
    renameLocalDevice,
    disconnectSession,
    reconnectSession,
    retryConnection,
    approvePendingDevice,
    rejectPendingDevice,
  } = useDevice()

  const [session, setSession] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)
  const [approvalBusy, setApprovalBusy] = useState(false)

  // Which half of the app is on screen. Jumps to sharing the moment a device
  // connects; "Show code" brings the pairing side back on demand.
  const [showPairView, setShowPairView] = useState(true)

  const initialisedRef = useRef(false)

  const currentDevice = localDevice
  const otherDevices = devices.filter((d) => d.id !== currentDevice.id)
  const paired = otherDevices.length > 0
  const pairedDeviceName = paired ? otherDevices[0].name : null

  // Unpaired there is nothing to share with, so the pairing side is the only
  // sensible view; paired, the user chooses.
  const onPairView = !paired || showPairView

  // Move to sharing as soon as a device joins. Keyed on `paired` alone, so
  // pressing "Show code" afterwards is not immediately undone by this.
  useEffect(() => {
    if (paired) setShowPairView(false)
  }, [paired])

  // The live sharing workspace and the pairing homepage both use `/`. Clicking
  // the navbar logo passes this state so it can still return to the QR view
  // without ending the active session.
  useEffect(() => {
    if (location.state?.showPairView) setShowPairView(true)
  }, [location.key, location.state?.showPairView])

  useEffect(() => {
    if (!location.hash) return

    setShowPairView(true)
    const timer = setTimeout(() => {
      document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)

    return () => clearTimeout(timer)
  }, [location.hash])

  // Initialize or fetch pairing session automatically
  useEffect(() => {
    // StrictMode runs mount effects twice in development; without this guard we
    // create — and immediately orphan — a second pairing session.
    if (initialisedRef.current) return
    initialisedRef.current = true

    const initSession = async () => {
      try {
        const existingId = localStorage.getItem('pairing_session_id')

        if (existingId) {
          try {
            const data = await getPairingSession(existingId)

            // A session with no code predates the code column. An open tab
            // keeps extending its expiry, so it would otherwise be reused
            // forever with nothing to type on the other device — replace it.
            if (data?.sessionId && data.code) {
              // The provider already opened a channel for this stored session.
              setSession(data)
              return
            }
          } catch {
            /* expired, or the server restarted — fall through to a new one */
          }

          localStorage.removeItem('pairing_session_id')
        }

        const newSession = await createPairingSession()
        localStorage.setItem('pairing_session_id', newSession.sessionId)
        setSession(newSession)

        // The provider only auto-connects to a session that already existed in
        // localStorage when it mounted, so a freshly created one has no channel
        // yet. Without this the host never joins and pairing silently fails.
        reconnectSession(newSession.sessionId)
      } catch (err) {
        console.error('Failed to initialize pairing session:', err)
        setSessionError('Could not reach the pairing server.')
      } finally {
        setLoadingSession(false)
      }
    }

    initSession()
  }, [reconnectSession])

  const startFreshSession = useCallback(async () => {
    const newSession = await createPairingSession()
    localStorage.setItem('pairing_session_id', newSession.sessionId)
    setSession(newSession)
    reconnectSession(newSession.sessionId)
  }, [reconnectSession])

  const handleDisconnect = async () => {
    if (disconnecting) return

    setDisconnecting(true)
    setSession(null)
    setSessionError('')
    setShowPairView(true)

    try {
      // Awaited: this deletes the session's files from Storage and drops the
      // session row, and must finish before a new session is issued.
      await disconnectSession()
      await startFreshSession()
    } catch (err) {
      console.error('Failed to start a new session after disconnect:', err)
      setSessionError('Could not create a new pairing session.')
    } finally {
      setDisconnecting(false)
      setConfirmingDisconnect(false)
    }
  }

  // The peer ended the session, so the row backing our code is gone. Swap in a
  // working one rather than leave a QR on screen that resolves to nothing.
  useEffect(() => {
    if (!endedSignal) return

    let active = true

    setShowPairView(true)
    setSession(null)

    startFreshSession().catch((err) => {
      if (!active) return
      console.error('Failed to start a new session after the peer left:', err)
      setSessionError('Could not create a new pairing session.')
    })

    return () => {
      active = false
    }
  }, [endedSignal, startFreshSession])

  // Detect a server-expired session even if Realtime stays quiet. Active
  // sessions are renewed by Presence, so this only replaces genuinely stale
  // codes left waiting without another device.
  useEffect(() => {
    if (!session?.sessionId) return

    const verifySession = async () => {
      try {
        const fresh = await getPairingSession(session.sessionId)
        setSession(fresh)
      } catch {
        if (!paired) {
          localStorage.removeItem('pairing_session_id')
          setSession(null)
          startFreshSession().catch(() => setSessionError('Could not renew the pairing session.'))
        }
      }
    }

    const timer = setInterval(verifySession, 60_000)
    return () => clearInterval(timer)
  }, [paired, session?.sessionId, startFreshSession])

  // Spelled out from what this device actually holds, so the warning is
  // concrete rather than a generic "are you sure?".
  const sharedFileCount = sharedItems.filter((item) => item.fileUrl).length

  // Counts only appear once there is something to count — three zeroes as the
  // focal point of the page said nothing and looked broken.
  const transferredBytes = sharedItems.reduce(
    (total, item) => total + (item.fileSize || 0),
    0,
  )

  const connectionSummary = sharedItems.length
    ? `${sharedItems.length} shared${transferredBytes ? ` · ${formatBytes(transferredBytes)}` : ''}`
    : `Connected to ${pairedDeviceName || 'the other device'}`

  const disconnectConsequences = [
    sharedFileCount > 0
      ? `${sharedFileCount} shared ${sharedFileCount === 1 ? 'file' : 'files'} will be deleted for good.`
      : 'Any shared files will be deleted for good.',
    'This activity feed will be cleared on both devices.',
    paired
      ? `${pairedDeviceName} will be disconnected.`
      : 'The current code will stop working.',
    'A new code will be generated so you can start again.',
  ]

  // The short code makes for a much denser QR than a 36-character UUID, and a
  // link short enough to read out. Falls back to the id if the schema predates
  // the code column.
  const pairingUrl = session
    ? `${window.location.origin}/pair/${session.code || session.sessionId}`
    : ''

  // Shown, never copied — `copyLink` still puts the full URL on the clipboard.
  // The scheme is the least useful ~8 characters in a string that has to fit a
  // 300px row, and dropping it is what keeps the code at the end visible.
  const displayUrl = pairingUrl.replace(/^https?:\/\//, '')

  const handleJoin = async (event) => {
    event.preventDefault()

    const code = normaliseCode(joinCode)
    if (code.length !== 6 || joining) return

    setJoining(true)
    setJoinError('')

    try {
      const target = await getPairingSessionByCode(code)

      if (target.sessionId === session?.sessionId) {
        setJoinError('That is this device’s own code.')
        return
      }

      navigate(`/pair/${code}`)
    } catch (err) {
      setJoinError(err.message)
    } finally {
      setJoining(false)
    }
  }

  const copyCode = async () => {
    if (!session?.code) return
    if (!(await copyText(session.code))) return

    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleDeviceDecision = async (approve) => {
    if (approvalBusy) return
    setApprovalBusy(true)
    try {
      await (approve ? approvePendingDevice() : rejectPendingDevice())
    } catch (error) {
      toast({
        tone: 'warning',
        title: 'Could not update the request',
        description: error?.message || 'Check the connection and try again.',
      })
    } finally {
      setApprovalBusy(false)
    }
  }

  // Copies the link, not the raw UUID: there is no "type a code" flow, so the
  // URL is the only thing a person can actually act on.
  const copyLink = async () => {
    if (!pairingUrl) return
    if (!(await copyText(pairingUrl))) return

    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const sharePairingLink = async () => {
    if (!pairingUrl || typeof navigator.share !== 'function') return

    try {
      await navigator.share({
        title: 'Connect with FLY',
        text: 'Open this link to connect our devices with FLY.',
        url: pairingUrl,
      })
    } catch (error) {
      if (error?.name !== 'AbortError') {
        toast({ tone: 'warning', title: 'Could not open sharing', description: 'Copy the connection link instead.' })
      }
    }
  }

  // A QR pointing at localhost resolves to the phone itself, not this machine.
  const isLocalhostOrigin = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(
    window.location.hostname,
  )

  return (
    // flex column so the footer settles at the bottom on short pages instead
    // of floating halfway up the viewport.
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      {/* Deliberately quiet: on the unpaired screen nothing should compete
          with the code for attention. */}
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        {onPairView ? (
          /* ── Pairing side ─────────────────────────────────────────────── */
          <section className="relative pt-6 sm:pt-16 lg:pt-20">
            {/* A faint dot grid, faded out toward the edges. Gives the hero
                something to sit on without adding a competing colour. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_1px_1px,var(--color-line)_1px,transparent_0)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_50%,transparent_100%)]"
            />

            {pendingDevice && (
              <div role="alert" className="animate-rise mb-6 flex flex-col gap-4 rounded-2xl border border-accent-line bg-accent-soft px-4 py-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
                    <FiShield size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Allow this device to connect?</p>
                    <p className="mt-1 truncate text-xs text-ink-soft">
                      {pendingDevice.name}
                      {[pendingDevice.browser, pendingDevice.os].filter((value) => value && !value.startsWith('Unknown')).length > 0
                        ? ` · ${[pendingDevice.browser, pendingDevice.os].filter((value) => value && !value.startsWith('Unknown')).join(' · ')}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                  <button type="button" disabled={approvalBusy} onClick={() => handleDeviceDecision(false)} className="rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:text-ink disabled:opacity-50">
                    Decline
                  </button>
                  <button type="button" disabled={approvalBusy} onClick={() => handleDeviceDecision(true)} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-button)] transition hover:bg-accent-hover disabled:opacity-50">
                    {approvalBusy ? 'Please wait...' : 'Allow device'}
                  </button>
                </div>
              </div>
            )}

            {/* Only reachable via "Show code" after pairing — connecting jumps
                straight to sharing, so this is the way back. */}
            {paired && (
              <div className="animate-rise mb-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ok-line bg-ok-soft px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ok text-white">
                    <FiCheck size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {pairedDeviceName} connected
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      You can start sharing straight away.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPairView(false)}
                  className="flex items-center gap-1.5 rounded-lg bg-accent-strong px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
                >
                  Go to sharing
                  <FiArrowRight size={15} />
                </button>
              </div>
            )}

            <div className="animate-rise relative left-1/2 w-[calc(100vw-2rem)] max-w-[1380px] -translate-x-1/2 overflow-hidden rounded-[2rem] border border-line-strong bg-surface shadow-[var(--shadow-float)] sm:w-[calc(100vw-3rem)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-accent-soft blur-3xl"
              />

              <div className="relative grid lg:min-h-[510px] lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
                {/* The product promise gets enough room to read like a real
                    landing page, while the QR remains the dominant action on
                    mobile by appearing first there. */}
                <div className="order-2 flex min-w-0 flex-col p-5 text-center sm:p-9 lg:order-1 lg:p-10 lg:text-left xl:px-12 xl:py-10">
                  <div className="flex flex-1 flex-col justify-center">
                    <div className="mx-auto hidden w-fit items-center gap-2 rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-hover sm:inline-flex lg:mx-0">
                      <FiShare2 size={13} aria-hidden="true" />
                      Fast, simple device sharing
                    </div>

                    <h1 className="mx-auto max-w-2xl text-[2.1rem] font-semibold leading-[1.04] tracking-[-0.045em] text-balance sm:mt-5 sm:text-5xl lg:mx-0 xl:text-[3.35rem]">
                      Move anything from this screen to the{' '}
                      <span className="bg-gradient-to-br from-brand-500 to-brand-700 bg-clip-text text-transparent">
                        next.
                      </span>
                    </h1>

                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink-soft sm:mt-4 sm:text-lg sm:leading-7 lg:mx-0">
                      <span className="sm:hidden">
                        Connect your devices and share notes, links and files instantly.
                      </span>
                      <span className="hidden sm:inline">
                        Scan once to connect your phone, tablet or computer. Send
                        notes, links and files instantly—no app, cable or setup.
                      </span>
                    </p>

                    <div className="mx-auto mt-5 hidden w-fit items-center gap-3 rounded-2xl border border-accent-line bg-accent-soft/70 px-4 py-3 text-left shadow-[var(--shadow-card)] sm:flex lg:mx-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-strong text-white shadow-[var(--shadow-button)]">
                        <FiSmartphone size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          Scan the QR code to begin
                        </p>
                        <p className="mt-0.5 text-xs text-ink-mute">
                          Your devices connect automatically
                        </p>
                      </div>
                      <FiArrowRight
                        size={17}
                        className="hidden shrink-0 text-accent sm:block"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="mx-auto mt-4 w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)] sm:mt-3 sm:rounded-2xl lg:mx-0">
                      <div className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised text-accent sm:h-9 sm:w-9 sm:rounded-xl">
                          <FiLink size={16} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-xs font-medium text-ink">
                            <span className="sm:hidden">Connection link</span>
                            <span className="hidden sm:inline">Share this connection link</span>
                          </p>
                          <p className="mt-0.5 truncate font-mono text-xs text-ink-mute">
                            {displayUrl}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={copyLink}
                          aria-label="Copy connection URL"
                          className="flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-raised text-xs font-medium text-ink-soft transition active:scale-[0.97] hover:border-line-strong hover:text-ink sm:h-auto sm:w-auto sm:px-3 sm:py-2"
                        >
                          {copiedLink ? (
                            <FiCheck size={13} className="text-ok" />
                          ) : (
                            <FiCopy size={13} />
                          )}
                          <span className="hidden sm:inline">
                            {copiedLink ? 'Copied' : 'Copy URL'}
                          </span>
                        </button>
                        {typeof navigator.share === 'function' && (
                          <button
                            type="button"
                            onClick={sharePairingLink}
                            aria-label="Share connection link"
                            className="flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-accent-line bg-accent-soft text-xs font-medium text-accent-hover transition active:scale-[0.97] hover:border-accent sm:h-auto sm:w-auto sm:px-3 sm:py-2"
                          >
                            <FiShare2 size={13} />
                            <span className="hidden sm:inline">Share</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-line pt-4 sm:mt-6 sm:pt-5">
                    <p className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.15em] text-ink-mute">
                      What you can share
                    </p>
                    <ul className="mt-2.5 flex items-center justify-center gap-3 sm:grid sm:grid-cols-3 sm:gap-2">
                      {CAPABILITIES.map((capability) => (
                        <li
                          key={capability.label}
                          className="flex min-w-0 items-center justify-center gap-1.5 text-[0.68rem] font-medium leading-tight text-ink-soft sm:rounded-lg sm:border sm:border-line sm:bg-raised/70 sm:px-2.5 sm:py-2 sm:text-xs sm:shadow-[var(--shadow-card)] lg:justify-start"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent sm:h-6 sm:w-6">
                            <capability.icon size={12} aria-hidden="true" />
                          </span>
                          <span className="sm:hidden">{capability.mobileLabel}</span>
                          <span className="hidden sm:inline">{capability.label}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 flex items-center justify-center gap-2 text-[0.68rem] text-ink-mute sm:mt-4 sm:text-xs lg:justify-start">
                      <FiShield size={13} className="shrink-0" aria-hidden="true" />
                      <span className="sm:hidden">Private by design.</span>
                      <span className="hidden sm:inline">
                        Private by design. No account required.
                      </span>
                    </p>
                  </div>
                </div>

                {/* A single tinted stage gives the QR a strong, uncluttered
                    home. It avoids the previous card-inside-card appearance. */}
                <div className="order-1 flex min-w-0 flex-col border-b border-line bg-[linear-gradient(145deg,var(--color-accent-soft),var(--color-raised)_62%)] p-4 sm:p-7 lg:order-2 lg:border-b-0 lg:border-l lg:p-7 xl:p-8">
                  <div className="flex flex-1 flex-col items-center justify-center">
                    <div className="mb-3 text-center sm:mb-5">
                      <h2 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
                        Scan to connect
                      </h2>
                      <p className="mt-1.5 text-sm text-ink-soft">
                        Open your camera and point it at the QR code
                      </p>
                    </div>

                    {loadingSession ? (
                      <div className="h-[17rem] w-full max-w-[240px] animate-pulse rounded-2xl border border-line bg-surface/70 sm:h-[25rem] sm:max-w-[320px] sm:rounded-3xl" />
                    ) : session ? (
                      <div className="w-full max-w-[240px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-raised)] sm:max-w-[320px]">
                        <div className="p-3 sm:p-4">
                          <div className="rounded-xl bg-white p-2">
                            <QRCodeSVG
                              value={pairingUrl}
                              size={320}
                              level="M"
                              className="h-auto w-full"
                            />
                          </div>
                        </div>

                      {session.code && (
                        <div className="flex items-center justify-center gap-2 border-t border-line px-3 py-3 sm:justify-between sm:gap-3 sm:px-5">
                          <span className="hidden font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] text-ink-mute sm:inline">
                            Code
                          </span>

                          <div className="flex items-center gap-2.5">
                            <span className="whitespace-nowrap font-mono text-2xl font-semibold tracking-[0.12em] text-ink sm:text-3xl sm:tracking-[0.16em]">
                              {formatCode(session.code)}
                            </span>

                            <button
                              type="button"
                              onClick={copyCode}
                              aria-label="Copy pairing code"
                              className="flex shrink-0 items-center justify-center rounded-lg border border-line bg-surface p-2 text-ink-soft shadow-[var(--shadow-card)] transition active:scale-[0.97] hover:border-line-strong hover:text-ink"
                            >
                              {copiedCode ? (
                                <FiCheck size={14} className="text-ok" />
                              ) : (
                                <FiCopy size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      </div>
                    ) : null}
                  </div>

                  <span aria-live="polite" className="sr-only">
                    {copiedCode ? 'Pairing code copied' : ''}
                    {copiedLink ? 'Pairing link copied' : ''}
                  </span>

                </div>
              </div>

              <div className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-line bg-raised px-5 py-3 sm:px-6">
                <span className="flex min-w-0 items-center gap-2 text-xs text-ink-soft">
                  <DeviceTypeIcon type={currentDevice.type} />
                  <span className="truncate">
                    This device — {currentDevice.name}
                  </span>
                </span>

                <span className="hidden items-center gap-2 text-xs text-ink-mute sm:flex">
                  {paired
                    ? `${pairedDeviceName} is connected`
                    : 'Your session is ready'}
                </span>
              </div>
            </div>

            {/* Developer aid, never shipped: Vite inlines import.meta.env.DEV
                as false in a production build, so this block is stripped. */}
            {import.meta.env.DEV && isLocalhostOrigin && (
              <p className="mx-auto mt-12 max-w-xl rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">
                Dev note: served over <code className="font-mono">localhost</code>, so
                the QR will not resolve from a phone. Use the Network URL from{' '}
                <code className="font-mono">npm run dev</code>.
              </p>
            )}

            {(sessionError || connectionError) && (
              <p className="mx-auto mt-12 max-w-xl rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
                {sessionError || connectionError}
              </p>
            )}

            {/* A compact alternative for devices without a camera. */}
            <div id="join-session" className="mx-auto mt-12 max-w-5xl scroll-mt-28 sm:mt-16">
              <div className="flex items-center gap-4">
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] text-ink-mute">
                  or
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <div className="mt-6 overflow-hidden rounded-3xl border border-line-strong bg-surface shadow-[var(--shadow-raised)]">
                <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
                  <div className="flex items-center gap-4 border-b border-line bg-[linear-gradient(135deg,var(--color-accent-soft),var(--color-raised))] px-5 py-5 text-left sm:px-7 lg:border-b-0 lg:border-r lg:px-8">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-strong text-white shadow-[var(--shadow-button)]">
                      <FiKey size={19} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-accent-hover">
                        Join a session
                      </p>
                      <h2 className="mt-1 text-base font-semibold tracking-tight text-ink sm:text-lg">
                        Have a pairing code?
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                        Enter the six characters shown on the other device.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleJoin}
                    className="flex flex-col justify-center p-5 sm:p-7 lg:px-8"
                  >
                    <label
                      htmlFor="join-code"
                      className="mb-2 font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-ink-mute"
                    >
                      Pairing code
                    </label>
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
                      <input
                        id="join-code"
                        value={formatCode(joinCode)}
                        onChange={(event) => {
                          setJoinCode(normaliseCode(event.target.value))
                          setJoinError('')
                        }}
                        placeholder="K7M-3QX"
                        inputMode="text"
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck="false"
                        className="w-full min-w-0 flex-1 rounded-xl border border-line-strong bg-raised px-4 py-3 text-center font-mono text-xl font-semibold uppercase tracking-[0.2em] text-ink placeholder-ink-mute shadow-[inset_0_2px_5px_rgba(18,20,29,0.05)] transition hover:border-ink-mute focus:bg-surface sm:text-2xl"
                      />

                      <button
                        type="submit"
                        disabled={normaliseCode(joinCode).length !== 6 || joining}
                        className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent-strong px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-button)] transition active:scale-[0.97] hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-mute disabled:shadow-none disabled:active:scale-100"
                      >
                        {joining ? 'Joining...' : 'Join device'}
                        {!joining && <FiArrowRight size={16} />}
                      </button>
                    </div>

                    {joinError && (
                      <p className="mt-3 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
                        {joinError}
                      </p>
                    )}
                  </form>
                </div>
              </div>
            </div>

            <div id="how-it-works" className="mt-16 scroll-mt-28 sm:mt-20">
              <div className="mx-auto max-w-xl text-center">
                <p className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.15em] text-accent-hover">
                  How it works
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
                  Three simple steps
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Scan, connect and start sharing in moments.
                </p>
              </div>

              <div className="relative mt-9">
                <span
                  aria-hidden="true"
                  className="absolute left-[16.66%] right-[16.66%] top-[18px] hidden h-px bg-accent-line sm:block"
                />

              <ol className="relative grid gap-0 sm:grid-cols-3">
                {STEPS.map((step, index) => (
                  <li
                    key={step.title}
                    className="relative flex items-start gap-4 pb-7 last:pb-0 sm:block sm:px-6 sm:pb-0 sm:text-center"
                  >
                    {index < STEPS.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 left-[17px] top-9 w-px bg-accent-line sm:hidden"
                      />
                    )}

                    <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-accent-line bg-surface text-sm font-semibold text-accent-hover sm:mx-auto">
                      {index + 1}
                    </span>

                    <div className="min-w-0 sm:mt-4">
                      <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.14em] text-ink-mute">
                        Step {String(index + 1).padStart(2, '0')}
                      </span>
                      <h3 className="mt-1.5 text-base font-semibold text-ink">
                        {step.title}
                      </h3>
                      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              </div>
            </div>
          </section>
        ) : (
          <SharingWorkspace
            localDevice={currentDevice}
            remoteDevice={otherDevices[0]}
            paired={paired}
            summary={connectionSummary}
            items={sharedItems}
            sessionId={session?.sessionId}
            expiresAt={session?.expiresAt}
            error={connectionError}
            connectionStatus={connectionStatus}
            disabled={!paired}
            disabledReason="Waiting for the other device to come online. Sharing turns on automatically."
            onSendText={sendText}
            onSendLink={sendLink}
            onSendFile={sendFile}
            onClearActivity={clearSharedItems}
            onRetryItem={retrySharedItem}
            onRemoveItem={removeSharedItem}
            onRenameDevice={renameLocalDevice}
            onRetryConnection={retryConnection}
            onShowCode={() => setShowPairView(true)}
            onDisconnect={() => setConfirmingDisconnect(true)}
            disconnecting={disconnecting}
          />
        )}
      </main>

      {/* Full footer while pairing; trimmed to the legal strip once a session
          is live, where the brand blurb is just noise above the feed. */}
      <Footer />

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

export default PairingPage
