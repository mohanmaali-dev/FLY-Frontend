import { getDeviceInfo } from './device.js'

const DEVICE_STORAGE_KEY = 'device_bridge_device'

export const getStoredDevice = () => {
    const storedDevice = localStorage.getItem(
        DEVICE_STORAGE_KEY,
    )

    if (storedDevice) {
        return JSON.parse(storedDevice)
    }

    const device = getDeviceInfo()

    localStorage.setItem(
        DEVICE_STORAGE_KEY,
        JSON.stringify(device),
    )

    return device
}