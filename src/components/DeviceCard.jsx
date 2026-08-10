import {
  FiCheck,
  FiMonitor,
  FiSmartphone,
  FiTablet,
} from 'react-icons/fi'

const deviceIcons = {
  mobile: FiSmartphone,
  tablet: FiTablet,
  desktop: FiMonitor,
}

const DeviceCard = ({
  device,
  current = false,
}) => {
  const DeviceIcon = deviceIcons[device.type] || FiMonitor

  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-border bg-white p-3 transition-colors hover:bg-ink-50 sm:gap-4 sm:p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-600 ring-1 ring-inset ring-border">
        <DeviceIcon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[13px] font-semibold text-ink-900 sm:text-sm">
            {device.name}
          </h3>

          {current && (
            <span className="badge bg-primary-50 text-primary-dark border border-primary-100">
              <FiCheck size={11} />
              This device
            </span>
          )}
        </div>

        <p className="mt-0.5 truncate text-[11px] text-ink-500 sm:text-xs">
          {device.browser} · {device.os}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="badge bg-ink-50 text-ink-600 border border-border capitalize">
          {device.type || 'device'}
        </span>
        <span
          className="status-dot bg-primary"
          title="Connected"
        />
      </div>
    </div>
  )
}

export default DeviceCard
