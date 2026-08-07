import {
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
    const DeviceIcon =
        deviceIcons[device.type] || FiMonitor

    return (
        <div className="flex items-center gap-4 rounded-2xl border border-primary-light bg-white p-4 transition-shadow hover:shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark">
                <DeviceIcon size={22} strokeWidth={1.8} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-ink">
                        {device.name}
                    </h3>

                    {current && (
                        <span className="shrink-0 rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-medium text-primary-dark">
                            This device
                        </span>
                    )}
                </div>

                <p className="mt-1 truncate text-xs text-ink/50">
                    {device.browser} · {device.os}
                </p>
            </div>

            <div
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                title="Connected"
            />
        </div>
    )
}

export default DeviceCard