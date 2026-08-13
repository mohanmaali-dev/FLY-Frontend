import { getDeviceInfo } from './device.js'

const DEVICE_STORAGE_KEY = 'device_bridge_device'

export const getStoredDevice = () => {
    const storedDevice = localStorage.getItem(DEVICE_STORAGE_KEY)

    if (storedDevice) {
        try {
            const parsed = JSON.parse(storedDevice)
            if (parsed.id && parsed.name) {
                const normalized = {
                    ...parsed,
                    joinedAt: parsed.joinedAt || Date.now(),
                }
                localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(normalized))
                return normalized
            }
        } catch {
            localStorage.removeItem(DEVICE_STORAGE_KEY)
        }
    }

    const device = getDeviceInfo()

    localStorage.setItem(
        DEVICE_STORAGE_KEY,
        JSON.stringify(device),
    )

    return device
}

export const renameStoredDevice = (name) => {
    const nextName = name.trim().replace(/\s+/g, ' ').slice(0, 48)
    if (nextName.length < 2) throw new Error('Use at least 2 characters for the device name.')

    const device = { ...getStoredDevice(), name: nextName }
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(device))
    return device
}
