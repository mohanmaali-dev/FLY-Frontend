import { getStoredDevice } from '../utils/device-session.js'

const getWebSocketUrl = () => {
  const apiUrl =
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000/api'

  const url = new URL(apiUrl)

  return `${
    url.protocol === 'https:'
      ? 'wss'
      : 'ws'
  }://${url.host}`
}

export const connectWebSocket = (
  sessionId,
  deviceType,
  deviceOverride = null,
) => {
  const socket = new WebSocket(
    getWebSocketUrl(),
  )

  const storedDevice = getStoredDevice()
  // Allow callers to pass a fully custom device (e.g. JoinPairingPage with a
  // fresh ID so same-browser tabs don't clash with the host device).
  let device = deviceOverride || storedDevice
  if (!deviceOverride && deviceType) {
    device = { ...storedDevice, type: deviceType }
  }

  socket.sessionId = sessionId

  socket.onopen = () => {
    console.log('WebSocket connected')

    socket.send(
      JSON.stringify({
        type: 'pairing:join',
        sessionId,
        device,
      }),
    )
  }

  socket.onerror = (event) => {
    console.error(
      'WebSocket connection failed',
      event,
    )
  }

  socket.onclose = () => {
    console.log('WebSocket disconnected')
  }

  return socket
}

export const sendDeviceMessage = (
  socket,
  payloadData,
) => {
  if (!socket || socket.readyState !== socket.OPEN) {
    throw new Error('WebSocket is not connected')
  }

  const device = getStoredDevice()
  const payload = typeof payloadData === 'string'
    ? { itemType: 'text', text: payloadData }
    : payloadData

  socket.send(
    JSON.stringify({
      type: 'device:message',
      sessionId: socket.sessionId,
      payload: {
        id: payload.id || Date.now().toString() + Math.random().toString(36).substring(2, 7),
        itemType: payload.itemType || 'text',
        text: payload.text || '',
        url: payload.url || '',
        fileName: payload.fileName || '',
        fileUrl: payload.fileUrl || '',
        fileSize: payload.fileSize || 0,
        mimeType: payload.mimeType || '',
        sender: device.name,
        timestamp: new Date().toISOString(),
      },
    }),
  )
}
