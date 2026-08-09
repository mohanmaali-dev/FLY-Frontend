import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  FiArrowRight,
  FiCheck,
  FiCopy,
  FiFile,
  FiFileText,
  FiKey,
  FiLink,
  FiLock,
  FiLogOut,
  FiMonitor,
  FiShield,
  FiSmartphone,
  FiTablet,
} from 'react-icons/fi'

import { useAuth } from '../context/AuthContext.jsx'
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
import SessionPanel from '../components/SessionPanel.jsx'
import { ShareControls } from '../components/ShareControls.jsx'
import { SharedItemsList } from '../components/SharedItemsList.jsx'
import { copyText } from '../utils/browser.js'
import { getStoredDevice } from '../utils/device-session.js'

const CAPABILITIES = [
  { icon: FiFileText, label: 'Text & notes' },
  { icon: FiLink, label: 'Links' },
  { icon: FiFile, label: 'Files up to 50 MB' },
]

// Same mapping SessionPanel uses, so the device reads as the same thing in the
// console footer here and in the sidebar once a session is live.
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
    body: 'Your phone opens this session. Both devices pair automatically.',
  },
  {
    title: 'Send anything',
    body: 'Text, links and files move instantly, in either direction.',
  },
]

function PairingPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const {
    connectionError,
    endedSignal,
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
  const [sessionError, setSessionError] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)

  // Which half of the app is on screen. Jumps to sharing the moment a device
  // connects; "Show code" brings the pairing side back on demand.
  const [showPairView, setShowPairView] = useState(true)

  const initialisedRef = useRef(false)

  const currentDevice = getStoredDevice()
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

  // Copies the link, not the raw UUID: there is no "type a code" flow, so the
  // URL is the only thing a person can actually act on.
  const copyLink = async () => {
    if (!pairingUrl) return
    if (!(await copyText(pairingUrl))) return

    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
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
      <AppHeader>
        <nav className="flex items-center gap-1">
          {user ? (
            <>
              <Link
                to="/notes"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-raised hover:text-ink"
              >
                Notes
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-raised hover:text-ink"
                title={user.name}
              >
                <FiLogOut size={15} />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-raised hover:text-ink"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-accent-strong px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </AppHeader>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        {onPairView ? (
          /* ── Pairing side ─────────────────────────────────────────────── */
          <section className="relative pt-12 sm:pt-16 lg:pt-20">
            {/* A faint dot grid, faded out toward the edges. Gives the hero
                something to sit on without adding a competing colour. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_1px_1px,var(--color-line)_1px,transparent_0)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_50%,transparent_100%)]"
            />

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

            {/* One frame, split down the middle, under a shared status bar.
                The previous two-column grid centred a 340px card inside a
                ~460px column, so it floated in dead space with nothing tying
                the halves together. Here a divider does the separating, and
                there is no gap left over to sit empty.

                min-w-0 on both halves is load-bearing: grid items default to
                min-width:auto, so the long unbreakable pairing URL set a
                ~550px min-content floor and stretched the single mobile
                column past the viewport. */}
            <div className="animate-rise overflow-hidden rounded-3xl border border-line-strong bg-surface shadow-[var(--shadow-float)]">
              {/* Connection state gets a permanent home here rather than a pill
                  floating above the headline, and the session id sits where you
                  would look for it on any console. */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-line bg-raised px-5 py-3 sm:px-6">
                <span className="flex items-center gap-2.5">
                  {paired ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-ok" />
                  ) : (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warn opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-warn" />
                    </span>
                  )}
                  <span className="font-mono text-xs font-medium uppercase tracking-wider text-ink-soft">
                    {paired
                      ? `${pairedDeviceName} connected`
                      : 'Waiting for a device'}
                  </span>
                </span>

                {session?.code && (
                  <span className="font-mono text-xs tracking-wider text-ink-mute">
                    Session {formatCode(session.code)}
                  </span>
                )}
              </div>

              {/* 1.05fr not 1fr: the copy half carries a headline that should
                  not wrap tighter than the QR half genuinely needs. */}
              <div className="grid lg:grid-cols-[1.05fr_1fr]">
                {/* Copy half. Second on a phone: the QR is the reason the page
                    exists, and burying it under a headline meant scrolling to
                    reach the one thing you came for. Source order stays
                    copy-first so it reads correctly to a screen reader on the
                    desktop layout, where the halves sit side by side. */}
                <div className="order-2 flex min-w-0 flex-col justify-center gap-6 p-6 text-center sm:p-9 lg:order-1 lg:p-10 lg:text-left">
                  <div>
                    {/* One accent word gives the headline a focal point without
                        scattering colour across the page. The gradient runs
                        between two brand steps, so it re-themes with the
                        palette. */}
                    <h1 className="text-display font-semibold text-balance sm:text-[2.6rem] lg:leading-[1.06]">
                      Share across your{' '}
                      <span className="bg-gradient-to-br from-brand-500 to-brand-700 bg-clip-text text-transparent">
                        devices
                      </span>
                    </h1>

                    <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-ink-soft lg:mx-0">
                      Point your phone at the code, or use it on another
                      computer. Whatever you send appears on the other screen
                      instantly.
                    </p>
                  </div>

                  {/* One line, no tiles. Three filled icon chips stacked in a
                      column read as three buttons you could press; laid out
                      horizontally on the panel's own ground they read as what
                      they are — a spec line under its label. */}
                  <div>
                    <p className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] text-ink-mute">
                      What you can send
                    </p>
                    <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 lg:justify-start">
                      {CAPABILITIES.map((capability) => (
                        <li
                          key={capability.label}
                          className="flex items-center gap-2 text-sm font-medium text-ink-soft"
                        >
                          <capability.icon
                            size={15}
                            className="shrink-0 text-accent"
                          />
                          {capability.label}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="flex items-center justify-center gap-2 text-sm text-ink-mute lg:justify-start">
                    <FiShield size={14} className="shrink-0" />
                    No account needed — the session ends when you do.
                  </p>
                </div>

                {/* QR half. Recessed grey rather than page white, so the white
                    QR panel visibly sits on something instead of dissolving
                    into the surface behind it.

                    The divider follows the layout: a bottom edge when this
                    stacks above the copy on a phone, a left edge when the two
                    sit side by side. */}
                <div className="order-1 flex min-w-0 flex-col items-center justify-center gap-4 border-b border-line bg-raised p-6 sm:p-8 lg:order-2 lg:border-b-0 lg:border-l">
                  {loadingSession ? (
                    // The assembled panel's real height at each width, so
                    // nothing jumps when the session resolves and swaps it in.
                    // Below sm the 360px cap does not bind, so the panel is
                    // narrower and correspondingly shorter.
                    <div className="h-[27rem] w-full max-w-[360px] animate-pulse rounded-2xl border border-line bg-sunken sm:h-[30rem]" />
                  ) : session ? (
                    /* One panel carries all three ways in: scan it, type the
                       code, or open the link. They are the same session, so
                       they belong in the same object. overflow-hidden lets the
                       two rows run edge to edge inside the corner radius.

                       Capped at 360 rather than 400: the QR is square, so every
                       pixel of panel width it gains is a pixel of console
                       height too, and the extra height was not wanted. */
                    <div className="w-full max-w-[360px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-raised)]">
                      <div className="p-4">
                        {/* Viewfinder brackets: says "scan me" before anyone
                            reads the caption underneath. */}
                        <div className="relative rounded-xl bg-white p-3">
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute left-1 top-1 h-7 w-7 rounded-tl-xl border-l-2 border-t-2 border-accent"
                          />
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute right-1 top-1 h-7 w-7 rounded-tr-xl border-r-2 border-t-2 border-accent"
                          />
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute bottom-1 left-1 h-7 w-7 rounded-bl-xl border-b-2 border-l-2 border-accent"
                          />
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute bottom-1 right-1 h-7 w-7 rounded-br-xl border-b-2 border-r-2 border-accent"
                          />

                          {/* The SVG carries a viewBox, so width:100% scales it
                              crisply — `size` only sets the intrinsic box. At
                              the 360px panel cap this renders about 304px
                              against the original card's 224px. */}
                          <QRCodeSVG
                            value={pairingUrl}
                            size={320}
                            level="M"
                            className="h-auto w-full"
                          />
                        </div>

                        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-ink-mute">
                          <FiSmartphone size={15} />
                          Point your camera here
                        </p>
                      </div>

                      {/* Both rows are a plain flex container with their own
                          copy control, not a giant button. A button cannot
                          legally contain another button, and the row-as-target
                          version gave a screen reader one unlabelled hit area
                          covering a heading, a value and a state icon. */}
                      {session.code && (
                        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
                          <span className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] text-ink-mute">
                            Code
                          </span>

                          <div className="flex items-center gap-2.5">
                            {/* The single biggest thing in the panel after the
                                QR: on a laptop this is what gets read aloud to
                                whoever is holding the other device. */}
                            <span className="font-mono text-3xl font-semibold tracking-[0.14em] text-ink">
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

                      {/* URL runs from the left, button pinned to the right
                          edge where the code row's button also lands, so the
                          two align. Given the whole run rather than only the
                          space left over beside the button, it truncates far
                          less — and `truncate` clips the tail, which is the
                          pairing code, the one part worth reading. Still set a
                          step down so a LAN address survives intact. */}
                      <div className="flex items-center gap-3 border-t border-line px-4 py-2.5">
                        <span className="shrink-0 font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] text-ink-mute">
                          Link
                        </span>

                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-soft">
                          {displayUrl}
                        </span>

                        <button
                          type="button"
                          onClick={copyLink}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft shadow-[var(--shadow-card)] transition active:scale-[0.97] hover:border-line-strong hover:text-ink"
                        >
                          {copiedLink ? (
                            <FiCheck size={13} className="text-ok" />
                          ) : (
                            <FiCopy size={13} />
                          )}
                          {copiedLink ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Both copy buttons swap their icon for a tick, which a
                      screen reader never announces. This says it out loud. */}
                  <span aria-live="polite" className="sr-only">
                    {copiedCode ? 'Pairing code copied' : ''}
                    {copiedLink ? 'Pairing link copied' : ''}
                  </span>
                </div>
              </div>

              {/* Footer strip. What this device is, and what happens to the
                  data — the same reassurance SessionPanel gives once a session
                  is live, so the landing and the live screen say one thing. */}
              <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-line bg-raised px-5 py-3 sm:px-6">
                <span className="flex min-w-0 items-center gap-2 text-xs text-ink-soft">
                  <DeviceTypeIcon type={currentDevice.type} />
                  <span className="truncate">
                    This device — {currentDevice.name}
                  </span>
                </span>

                <span className="flex items-center gap-2 text-xs text-ink-mute">
                  <FiLock size={13} className="shrink-0" aria-hidden="true" />
                  Everything clears when you disconnect.
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

            {/* The other half of pairing: this device joining someone else.
                Without it a second laptop had no way in at all — the QR needs
                a camera, and nobody is retyping a 36-character link. */}
            <div className="mx-auto mt-16 max-w-2xl sm:mt-20">
              <div className="flex items-center gap-4">
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] text-ink-mute">
                  or
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>

              {/* Framed like the console above — header strip, hairline, body —
                  so the two halves of pairing read as the same product. Still
                  recessed rather than raised: this is the secondary way in and
                  should not outweigh the QR it sits beneath. */}
              <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-raised">
                <div className="flex items-center gap-3.5 border-b border-line bg-surface px-5 py-4 text-left sm:px-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-line bg-accent-soft text-accent">
                    <FiKey size={18} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold tracking-tight">
                      Have a code from another device?
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      Type it in to join that session.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleJoin} className="p-5 sm:p-7">
                  {/* items-stretch so the button matches the taller input
                      rather than centring against it and leaving two unequal
                      rounded rectangles side by side. */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <input
                      value={formatCode(joinCode)}
                      onChange={(event) => {
                        setJoinCode(normaliseCode(event.target.value))
                        setJoinError('')
                      }}
                      placeholder="K7M-3QX"
                      aria-label="Pairing code from the other device"
                      inputMode="text"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck="false"
                      // Set at the same weight as the code the console shows,
                      // so what you read off one device and what you type into
                      // the other look like the same object. A recessed fill
                      // and a stronger border keep it obviously typeable
                      // against the card's raised grey.
                      className="w-full min-w-0 flex-1 rounded-2xl border border-line-strong bg-surface px-4 py-4 text-center font-mono text-2xl font-semibold uppercase tracking-[0.2em] text-ink placeholder-ink-mute shadow-[inset_0_2px_5px_rgba(18,20,29,0.06)] transition hover:border-ink-mute focus:bg-surface sm:text-3xl"
                    />

                    <button
                      type="submit"
                      disabled={normaliseCode(joinCode).length !== 6 || joining}
                      className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-accent-strong px-7 py-4 text-base font-medium text-white shadow-[var(--shadow-button)] transition active:scale-[0.97] hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-mute disabled:shadow-none disabled:active:scale-100"
                    >
                      {joining ? 'Joining...' : 'Join'}
                      {!joining && <FiArrowRight size={17} />}
                    </button>
                  </div>

                  {joinError && (
                    <p className="mt-3.5 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
                      {joinError}
                    </p>
                  )}
                </form>
              </div>
            </div>

            {/* How it works. Given a heading and cards of its own rather than
                left as a bare list under a rule — unlabelled, three numbered
                paragraphs read as a continuation of the join form above. */}
            <div className="mt-20 sm:mt-24">
              <h2 className="text-center text-xs font-medium uppercase tracking-wider text-ink-mute">
                How it works
              </h2>

              <ol className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-5">
                {STEPS.map((step, index) => (
                  <li
                    key={step.title}
                    className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-strong text-sm font-semibold text-white shadow-[var(--shadow-button)]">
                      {index + 1}
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                      {step.body}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : (
          /* ── Sharing side ─────────────────────────────────────────────── */
          <section className="pt-8">
            <h1 className="text-xl font-semibold tracking-tight">Sharing</h1>

            {connectionError && (
              <p className="mt-5 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
                {connectionError}
              </p>
            )}

            {/* Composer and feed on the left, session state on the right. The
                panel is first in source order so a phone sees connection state
                and Disconnect straight away — stacked last it sat below the
                whole activity feed. */}
            <div className="mt-4 grid items-start gap-5 sm:mt-5 sm:gap-6 lg:grid-cols-12">
              <div className="order-1 min-w-0 lg:sticky lg:top-6 lg:order-2 lg:col-span-5 xl:col-span-4">
                <SessionPanel
                  localDevice={currentDevice}
                  remoteDevice={otherDevices[0]}
                  paired={paired}
                  summary={connectionSummary}
                  onShowCode={() => setShowPairView(true)}
                  onDisconnect={() => setConfirmingDisconnect(true)}
                  disconnecting={disconnecting}
                />
              </div>

              <div className="order-2 min-w-0 space-y-8 lg:order-1 lg:col-span-7 xl:col-span-8">
                <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6">
                  <ShareControls
                    sessionId={session?.sessionId}
                    onSendText={sendText}
                    onSendLink={sendLink}
                    onSendFile={sendFile}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
                    {sharedItems.length > 0 && (
                      <span className="text-sm tabular-nums text-ink-mute">
                        {sharedItems.length} item
                        {sharedItems.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  <SharedItemsList items={sharedItems} />
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Full footer while pairing; trimmed to the legal strip once a session
          is live, where the brand blurb is just noise above the feed. */}
      <Footer compact={!onPairView} />

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
