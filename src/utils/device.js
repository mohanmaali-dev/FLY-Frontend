import { UAParser } from 'ua-parser-js'

const parser = new UAParser()

const result = parser.getResult()

const getDeviceType = () => {
  if (result.device.type === 'mobile') {
    return 'mobile'
  }

  if (result.device.type === 'tablet') {
    return 'tablet'
  }

  return 'desktop'
}

const getDeviceName = (type) => {
  const browserName = result.browser.name || 'Browser'
  const osName = result.os.name || ''

  if (result.device.vendor || result.device.model) {
    const model = `${result.device.vendor || ''} ${result.device.model || ''}`.trim()
    return `${model} (${browserName})`
  }

  if (osName) {
    return `${browserName} on ${osName}`
  }

  return `${browserName} (${type})`
}

export const getDeviceInfo = () => {
  const type = getDeviceType()

  return {
    id: crypto.randomUUID(),
    name: getDeviceName(type),
    type,
    browser: result.browser.name || 'Unknown Browser',
    os: result.os.name || 'Unknown OS',
    osVersion: result.os.version || '',
  }
}