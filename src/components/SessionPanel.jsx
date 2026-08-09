import {
  FiLock,
  FiMonitor,
  FiPower,
  FiSmartphone,
  FiTablet,
} from 'react-icons/fi'
// Lucide is a fork of Feather on the same 24px grid and stroke weight, so this
// sits correctly beside the Fi* icons. Feather itself has no QR glyph.
import { LuQrCode } from 'react-icons/lu'

const deviceIcons = {
  mobile: FiSmartphone,
  tablet: FiTablet,
  desktop: FiMonitor,
}

function DeviceIcon({ type, tone = 'muted' }) {
  const Icon = deviceIcons[type] || FiMonitor

  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
        tone === 'accent'
          ? 'border-accent-line bg-accent-soft text-accent'
          : 'border-line bg-raised text-ink-soft'
      }`}
    >
      <Icon size={19} strokeWidth={1.7} />
    </span>
  )
}

/**
 * The session sidebar, rendered identically by the host and the guest.
 *
 * Both screens previously had their own arrangement of the same information —
 * link state, device list, session actions — which is why the two sides looked
 * like different products and why the laptop layout had an empty column.
 */
export function SessionPanel({
  localDevice,
  remoteDevice,
  paired,
  summary,
  onShowCode,
  onDisconnect,
  disconnecting = false,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
      {/* Link state */}
      <div className="border-b border-line bg-raised px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <DeviceIcon type={localDevice?.type} tone="accent" />

          <div className="relative min-w-0 flex-1">
            <svg
              className="h-6 w-full"
              viewBox="0 0 120 6"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1="0"
                y1="3"
                x2="120"
                y2="3"
                stroke="var(--color-line-strong)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {paired && (
                <line
                  x1="0"
                  y1="3"
                  x2="120"
                  y2="3"
                  stroke="var(--color-ok)"
                  strokeWidth="2.5"
                  strokeDasharray="10 110"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="animate-flow"
                />
              )}
            </svg>
          </div>

          <DeviceIcon type={remoteDevice?.type} tone={paired ? 'accent' : 'muted'} />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              paired ? 'bg-ok' : 'animate-pulse bg-warn'
            }`}
          />
          <p className="min-w-0 truncate text-sm font-medium text-ink">
            {paired ? summary : 'Waiting for the other device'}
          </p>
        </div>
      </div>

      {/* Devices */}
      <div className="px-4 py-4 sm:px-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-ink-mute">
          Devices
        </h2>

        <ul className="mt-3 space-y-3">
          <li className="flex min-w-0 items-center gap-3">
            <DeviceIcon type={localDevice?.type} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {localDevice?.name || 'This device'}
              </p>
              <p className="mt-0.5 text-xs text-ink-mute">This device</p>
            </div>
          </li>

          {remoteDevice ? (
            <li className="flex min-w-0 items-center gap-3">
              <DeviceIcon type={remoteDevice.type} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {remoteDevice.name}
                </p>
                <p className="mt-0.5 text-xs text-ok">Connected</p>
              </div>
            </li>
          ) : (
            <li className="rounded-xl border border-dashed border-line px-4 py-4 text-center text-xs text-ink-mute">
              No other device yet
            </li>
          )}
        </ul>
      </div>

      {/* Actions. Side by side on a phone so the panel stays short; stacked in
          the desktop sidebar where there is width to spare. */}
      <div className="flex gap-2 border-t border-line px-4 py-4 sm:px-5 lg:flex-col">
        {onShowCode && (
          <button
            type="button"
            onClick={onShowCode}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-medium text-ink-soft shadow-[var(--shadow-card)] transition active:scale-[0.98] hover:border-line-strong hover:text-ink"
          >
            <LuQrCode size={15} />
            <span className="truncate">Show code</span>
          </button>
        )}

        <button
          type="button"
          onClick={onDisconnect}
          disabled={disconnecting}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-danger-line bg-surface px-3 py-2.5 text-sm font-medium text-danger transition active:scale-[0.98] hover:bg-danger-soft disabled:opacity-50"
        >
          <FiPower size={15} />
          <span className="truncate">
            {disconnecting ? 'Clearing...' : 'Disconnect'}
          </span>
        </button>
      </div>

      {/* Reassurance, not instruction — worth the space on a desktop sidebar,
          not worth pushing the composer down a phone screen. */}
      <p className="hidden items-start gap-2.5 border-t border-line bg-raised px-5 py-4 text-xs leading-relaxed text-ink-mute lg:flex">
        <FiLock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Everything here clears when you disconnect.
      </p>
    </section>
  )
}

export default SessionPanel
