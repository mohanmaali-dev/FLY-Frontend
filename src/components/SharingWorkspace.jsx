import { useEffect, useState } from 'react'
import {
  FiArrowRight,
  FiCheckCircle,
  FiMonitor,
  FiEdit2,
  FiPower,
  FiRefreshCw,
  FiSun,
  FiSmartphone,
  FiTablet,
  FiTrash2,
  FiWifiOff,
} from 'react-icons/fi'
import { LuQrCode } from 'react-icons/lu'

import { ShareControls } from './ShareControls.jsx'
import { SharedItemsList } from './SharedItemsList.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { useToast } from './Toast.jsx'
import { toUserMessage } from '../utils/errors.js'
import { useScreenWakeLock } from '../hooks/useScreenWakeLock.js'

const DEVICE_ICONS = {
  mobile: FiSmartphone,
  tablet: FiTablet,
  desktop: FiMonitor,
}

function DeviceIdentity({ device, label, connected = false }) {
  const Icon = DEVICE_ICONS[device?.type] || FiMonitor

  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:h-11 sm:w-11 ${
          connected
            ? 'border-accent-line bg-accent-soft text-accent'
            : 'border-line bg-surface text-ink-soft'
        }`}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[0.6rem] font-medium uppercase tracking-[0.13em] text-ink-mute">
          {label}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-ink" title={device?.name}>
          {device?.name || 'Waiting for device'}
        </p>
        {device && (
          <p className="mt-0.5 hidden truncate text-[0.68rem] text-ink-mute sm:block">
            {[device.browser, device.os].filter((value) => value && !value.startsWith('Unknown')).join(' · ') || device.type}
          </p>
        )}
      </div>
    </div>
  )
}

export function SharingWorkspace({
  localDevice,
  remoteDevice,
  paired,
  summary,
  items = [],
  sessionId,
  error = '',
  connectionStatus = 'connected',
  disabled = false,
  disabledReason = '',
  onSendText,
  onSendLink,
  onSendFile,
  onClearActivity,
  onRetryItem,
  onRemoveItem,
  onRenameDevice,
  onRetryConnection,
  onShowCode,
  onDisconnect,
  disconnecting = false,
}) {
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [deviceName, setDeviceName] = useState(localDevice?.name || '')
  const [savingName, setSavingName] = useState(false)
  const [showConnectedWelcome, setShowConnectedWelcome] = useState(false)
  const { toast } = useToast()
  const wakeLock = useScreenWakeLock()
  const connectionInterrupted = ['offline', 'reconnecting', 'disconnected'].includes(
    connectionStatus,
  )
  const connectionLabel = {
    idle: 'Session ready',
    connecting: 'Connecting to session',
    connected: paired ? 'Devices connected' : 'Waiting for another device',
    reconnecting: 'Reconnecting',
    offline: 'You are offline',
    disconnected: 'Connection interrupted',
  }[connectionStatus] || 'Checking connection'

  useEffect(() => setDeviceName(localDevice?.name || ''), [localDevice?.name])

  useEffect(() => {
    if (!paired) {
      setShowConnectedWelcome(false)
      return
    }

    setShowConnectedWelcome(true)
    const timer = setTimeout(() => setShowConnectedWelcome(false), 6000)
    return () => clearTimeout(timer)
  }, [paired])

  const saveDeviceName = async (event) => {
    event.preventDefault()
    if (!onRenameDevice || savingName) return
    setSavingName(true)
    try {
      await onRenameDevice(deviceName)
      setEditingName(false)
      toast({ tone: 'success', title: 'Device name updated' })
    } catch (error) {
      toast({ tone: 'error', title: 'Could not rename device', description: toUserMessage(error) })
    } finally {
      setSavingName(false)
    }
  }

  const clearActivity = async () => {
    if (!onClearActivity || clearing) return

    setClearing(true)
    try {
      await onClearActivity()
      setConfirmingClear(false)
      toast({ tone: 'success', title: 'Transfer activity cleared' })
    } catch (error) {
      toast({
        tone: 'warning',
        title: 'Could not clear activity',
        description: toUserMessage(error),
      })
    } finally {
      setClearing(false)
    }
  }

  const toggleWakeLock = async () => {
    try {
      if (wakeLock.enabled) {
        await wakeLock.disable()
      } else {
        await wakeLock.enable()
      }
    } catch {
      toast({
        tone: 'warning',
        title: 'Could not keep the screen awake',
        description: 'Your browser or device blocked this setting.',
      })
    }
  }

  return (
    <section className="relative left-1/2 w-[calc(100vw-2rem)] max-w-[1380px] -translate-x-1/2 pt-6 sm:w-[calc(100vw-3rem)] sm:pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionInterrupted
                  ? 'bg-danger'
                  : paired
                    ? 'bg-ok'
                    : 'animate-pulse bg-warn'
              }`}
            />
            <span
              className={`font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] ${
                connectionInterrupted ? 'text-danger' : paired ? 'text-ok' : 'text-warn'
              }`}
            >
              {connectionLabel}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Device sharing
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Both devices can send and receive from the same workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {paired ? (
            <span className="w-fit rounded-full border border-ok-line bg-ok-soft px-3 py-1.5 text-xs text-ok" title="Active sessions renew automatically">Session active</span>
          ) : (
            <span className="w-fit rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-xs text-accent-hover">
              Ready to connect
            </span>
          )}
          {items.length > 0 && (
            <span className="w-fit rounded-full border border-line bg-raised px-3 py-1.5 text-xs tabular-nums text-ink-soft">{items.length} transfer{items.length === 1 ? '' : 's'}</span>
          )}
        </div>
      </div>

      {connectionInterrupted && (
        <div role="status" className="mt-5 flex flex-col gap-3 rounded-xl border border-warn-line bg-warn-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <FiWifiOff size={17} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink">{connectionLabel}</p>
              <p className="mt-0.5 text-sm text-warn">
                {connectionStatus === 'offline'
                  ? 'Check your internet connection. FLY will retry when you are online.'
                  : 'Your session is still available. Try reconnecting to continue sharing.'}
              </p>
            </div>
          </div>
          {onRetryConnection && (
            <button
              type="button"
              onClick={onRetryConnection}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-warn-line bg-surface px-3 py-2 text-xs font-semibold text-warn transition hover:border-warn hover:text-ink"
            >
              <FiRefreshCw size={13} />
              Try again
            </button>
          )}
        </div>
      )}

      {showConnectedWelcome && !connectionInterrupted && (
        <div role="status" className="mt-5 flex items-start gap-3 rounded-xl border border-ok-line bg-ok-soft px-4 py-3 text-ok">
          <FiCheckCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink">You&apos;re connected</p>
            <p className="mt-0.5 text-sm text-ok">Share from either device whenever you&apos;re ready.</p>
          </div>
        </div>
      )}

      {error && !connectionInterrupted && (
        <p className="mt-5 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-raised shadow-[var(--shadow-raised)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {onRenameDevice && (
              <button type="button" onClick={() => setEditingName((value) => !value)} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-soft transition hover:border-line-strong hover:text-ink">
                <FiEdit2 size={13} /> Rename
              </button>
            )}
            <span
              className={`h-2 w-2 rounded-full ${
                connectionInterrupted ? 'bg-danger' : paired ? 'bg-ok' : 'bg-warn'
              }`}
            />
            <p className="text-sm font-medium text-ink">
              {connectionInterrupted
                ? connectionLabel
                : paired
                  ? summary
                  : connectionStatus === 'connecting'
                    ? 'Connecting to the session'
                    : 'Waiting for the other device'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {wakeLock.supported && (
              <button
                type="button"
                onClick={toggleWakeLock}
                aria-pressed={wakeLock.enabled}
                title={wakeLock.enabled ? 'Allow the screen to sleep' : 'Keep this screen awake'}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  wakeLock.enabled
                    ? 'border-accent-line bg-accent-soft text-accent-hover'
                    : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink'
                }`}
              >
                <FiSun size={14} />
                <span className="hidden sm:inline">{wakeLock.active ? 'Screen awake' : 'Keep awake'}</span>
              </button>
            )}
            {onShowCode && (
              <button
                type="button"
                onClick={onShowCode}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-soft transition hover:border-line-strong hover:text-ink"
              >
                <LuQrCode size={14} />
                Show code
              </button>
            )}
            <button
              type="button"
              onClick={onDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 rounded-lg border border-danger-line bg-surface px-3 py-2 text-xs font-medium text-danger transition hover:bg-danger-soft disabled:opacity-50"
            >
              <FiPower size={14} />
              {disconnecting ? 'Ending...' : 'End session'}
            </button>
          </div>
        </div>

        {editingName && (
          <form onSubmit={saveDeviceName} className="flex flex-col gap-2 border-b border-line bg-accent-soft/40 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <label htmlFor="device-name" className="shrink-0 text-xs font-semibold text-ink-soft">This device name</label>
            <input id="device-name" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} maxLength={48} autoFocus className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink" />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setEditingName(false); setDeviceName(localDevice?.name || '') }} className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-soft sm:flex-none">Cancel</button>
              <button type="submit" disabled={savingName || deviceName.trim().length < 2} className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 sm:flex-none">{savingName ? 'Saving...' : 'Save name'}</button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-4 sm:gap-6 sm:px-6 sm:py-5">
          <DeviceIdentity device={localDevice} label="This device" connected />

          <span className="flex items-center gap-1.5 text-accent" aria-hidden="true">
            <span className="hidden h-px w-6 bg-accent-line sm:block" />
            <FiArrowRight size={17} />
            <span className="hidden h-px w-6 bg-accent-line sm:block" />
          </span>

          <DeviceIdentity
            device={remoteDevice}
            label="Other device"
            connected={paired}
          />
        </div>
      </section>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch lg:gap-6">
        <section className="h-full rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5 lg:sticky lg:top-20">
          <ShareControls
            sessionId={sessionId}
            disabled={disabled}
            disabledReason={disabledReason}
            onSendText={onSendText}
            onSendLink={onSendLink}
            onSendFile={onSendFile}
            onRemoveItem={onRemoveItem}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-ink">
                Recent transfers
              </h2>
              <p className="mt-0.5 text-xs text-ink-mute">
                Sent and received items appear here.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs tabular-nums text-ink-mute">
                {items.length || 0} item{items.length === 1 ? '' : 's'}
              </span>
              {items.length > 0 && onClearActivity && (
                <button
                  type="button"
                  onClick={() => setConfirmingClear(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink-mute transition hover:border-danger-line hover:bg-danger-soft hover:text-danger"
                  aria-label="Clear transfer activity"
                  title="Clear activity"
                >
                  <FiTrash2 size={14} />
                </button>
              )}
            </div>
          </header>

          <div className="min-h-[330px] bg-raised/60 p-3 sm:p-4 lg:max-h-[620px] lg:overflow-y-auto">
            <SharedItemsList items={items} onRetryItem={onRetryItem} onRemoveItem={onRemoveItem} />
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmingClear}
        title="Clear transfer activity?"
        description="This removes the visible activity from both connected devices."
        consequences={[
          'Text, links and file entries will disappear from both screens.',
          'Uploaded files are still deleted automatically when the session ends.',
          'This does not disconnect either device.',
        ]}
        confirmLabel="Clear activity"
        cancelLabel="Keep activity"
        busy={clearing}
        busyLabel="Clearing..."
        onConfirm={clearActivity}
        onCancel={() => setConfirmingClear(false)}
      />
    </section>
  )
}

export default SharingWorkspace
