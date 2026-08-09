import { FiMonitor, FiSmartphone, FiTablet } from 'react-icons/fi'

const deviceIcons = {
  mobile: FiSmartphone,
  tablet: FiTablet,
  desktop: FiMonitor,
}

const DeviceCard = ({ device, current = false }) => {
  const DeviceIcon = deviceIcons[device.type] || FiMonitor

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-card)] transition hover:border-line-strong">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-ink-soft">
        <DeviceIcon size={17} strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium text-ink">{device.name}</h3>

          {current && (
            <span className="shrink-0 rounded-md bg-raised px-1.5 py-0.5 text-xs text-ink-mute">
              This device
            </span>
          )}
        </div>

        <p className="mt-0.5 truncate text-sm text-ink-mute">
          {device.browser} &middot; {device.os}
        </p>
      </div>

      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok"
        title="Connected"
        aria-label="Connected"
      />
    </div>
  )
}

export default DeviceCard
