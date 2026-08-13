import { supabase } from './supabase.js'
import { toUserMessage, userError } from '../utils/errors.js'
import { touchPairingSession } from './pairing.service.js'
import {
  createSlidingWindowLimiter,
  MAX_LINK_LENGTH,
  MAX_LINK_NOTE_LENGTH,
  MAX_TEXT_LENGTH,
} from '../utils/transfer.js'
import { selectSessionDevices } from '../utils/session-admission.js'

const MESSAGE_EVENT = 'device:message'
const ENDED_EVENT = 'pairing:ended'
const CLEARED_EVENT = 'pairing:cleared'
const DELIVERED_EVENT = 'device:delivered'
const REMOVED_EVENT = 'device:removed'

const channelName = (sessionId) => `pairing:${sessionId}`

const randomId = () =>
  Date.now().toString() + Math.random().toString(36).substring(2, 7)

/**
 * Joins a pairing session over Supabase Realtime.
 *
 * Replaces the old `ws` relay one-for-one:
 *   the server's per-session socket Set  -> Presence on the channel
 *   the server's message fan-out         -> Broadcast on the channel
 *
 * Presence is keyed by device id, so a reconnecting device (refresh, StrictMode
 * remount) replaces its own entry instead of appearing twice — the same thing
 * the old server did by closing the stale socket.
 *
 * The channel name contains the session UUID, so knowing the id is what grants
 * access. That matches the previous model exactly, where any client that knew
 * the id could open a socket for it.
 *
 * Returns a handle with `send` and `close`.
 */
export const joinPairingChannel = ({
  sessionId,
  device,
  onDevices,
  onMessage,
  onEnded,
  onCleared,
  onDelivery,
  onRemoved,
  onFull,
  onError,
  onStatus,
}) => {
  let currentDevice = device
  let intentionallyClosed = false
  let keepAliveTimer = null
  let admitted = true
  let admittedIds = new Set([device.id])
  const canSend = createSlidingWindowLimiter()
  const channel = supabase.channel(channelName(sessionId), {
    config: {
      presence: { key: device.id },
      // Never echo our own broadcast back; both callers append optimistically.
      broadcast: { self: false },
    },
  })

  channel.on('presence', { event: 'sync' }, () => {
    const allDevices = Object.values(channel.presenceState())
      .map((entries) => entries[0]?.device)
      .filter(Boolean)

    const devices = selectSessionDevices(allDevices)
    admittedIds = new Set(devices.map((entry) => entry.id))
    admitted = admittedIds.has(currentDevice.id)

    onDevices?.(devices)
    if (!admitted) onFull?.(devices)

    // Keeps `status` accurate and pushes out expiry while devices are attached,
    // so an active pairing is never expired out from under its devices.
    touchPairingSession(sessionId, devices.length).catch(() => {
      /* advisory only — a failure here must not drop the connection */
    })
  })

  channel.on('broadcast', { event: MESSAGE_EVENT }, ({ payload }) => {
    if (!payload) return
    if (!admitted || (payload.senderId && !admittedIds.has(payload.senderId))) return
    onMessage?.(payload)
    channel.send({
      type: 'broadcast',
      event: DELIVERED_EVENT,
      payload: { id: payload.id, receiverId: currentDevice.id },
    }).catch(() => {})
  })

  channel.on('broadcast', { event: DELIVERED_EVENT }, ({ payload }) => {
    if (payload?.id && (!payload.receiverId || admittedIds.has(payload.receiverId))) {
      onDelivery?.(payload.id)
    }
  })

  channel.on('broadcast', { event: REMOVED_EVENT }, ({ payload }) => {
    if (payload?.id && (!payload.senderId || admittedIds.has(payload.senderId))) {
      onRemoved?.(payload.id)
    }
  })

  // Either side can end the session. Without this the other device keeps a
  // history full of links to files that have just been deleted.
  channel.on('broadcast', { event: ENDED_EVENT }, ({ payload }) => {
    if (!payload?.senderId || admittedIds.has(payload.senderId)) {
      onEnded?.(payload?.by || 'The other device')
    }
  })

  channel.on('broadcast', { event: CLEARED_EVENT }, ({ payload }) => {
    if (!payload?.senderId || admittedIds.has(payload.senderId)) onCleared?.()
  })

  channel.subscribe((status, error) => {
    if (status === 'SUBSCRIBED') {
      onStatus?.('connected')
      channel.track({ device: currentDevice })
      clearInterval(keepAliveTimer)
      keepAliveTimer = setInterval(() => {
        const count = Object.values(channel.presenceState()).length || 1
        touchPairingSession(sessionId, count).catch(() => {})
      }, 4 * 60 * 1000)
      return
    }

    if (status === 'CHANNEL_ERROR') {
      onStatus?.('reconnecting')
      onError?.(toUserMessage(error, 'Connection lost. Trying to reconnect.'))
      return
    }

    if (status === 'TIMED_OUT') {
      onStatus?.(navigator.onLine ? 'reconnecting' : 'offline')
      onError?.('Connection timed out. Check your network and reload.')
      return
    }

    if (status === 'CLOSED' && !intentionallyClosed) {
      onStatus?.('disconnected')
      onError?.('Connection closed. Trying to reconnect.')
    }

  })

  return {
    channel,

    send: async (payloadData) => {
      if (!admitted) throw userError('This session already has two connected devices.')
      if (!canSend()) {
        throw userError('You are sending too quickly. Wait a moment and try again.')
      }

      const payload =
        typeof payloadData === 'string'
          ? { itemType: 'text', text: payloadData }
          : payloadData

      if (payload.itemType === 'text' && String(payload.text || '').length > MAX_TEXT_LENGTH) {
        throw userError(`Text is limited to ${MAX_TEXT_LENGTH.toLocaleString()} characters.`)
      }
      if (payload.itemType === 'link') {
        if (String(payload.url || '').length > MAX_LINK_LENGTH) {
          throw userError('That link is too long.')
        }
        if (String(payload.text || '').length > MAX_LINK_NOTE_LENGTH) {
          throw userError('That link note is too long.')
        }
      }

      const message = {
        id: payload.id || randomId(),
        itemType: payload.itemType || 'text',
        text: payload.text || '',
        url: payload.url || '',
        fileName: payload.fileName || '',
        fileUrl: payload.fileUrl || '',
        fileSize: payload.fileSize || 0,
        mimeType: payload.mimeType || '',
        storagePath: payload.storagePath || '',
        sender: currentDevice.name,
        senderId: currentDevice.id,
        timestamp: payload.timestamp || new Date().toISOString(),
      }

      const result = await channel.send({
        type: 'broadcast',
        event: MESSAGE_EVENT,
        payload: message,
      })

      if (result !== 'ok') {
        throw userError('Not connected. Waiting for the other device.')
      }

      return message
    },

    /** Tells the other device the session is over, before the files vanish. */
    announceEnd: async () => {
      try {
        await channel.send({
          type: 'broadcast',
          event: ENDED_EVENT,
          payload: { by: currentDevice.name, senderId: currentDevice.id },
        })
      } catch {
        /* the other side falls back to noticing the presence drop */
      }
    },

    clearActivity: async () => {
      const result = await channel.send({
        type: 'broadcast',
        event: CLEARED_EVENT,
        payload: { by: currentDevice.name, senderId: currentDevice.id },
      })

      if (result !== 'ok') {
        throw userError('Could not clear activity on the other device.')
      }
    },

    removeItem: async (id) => {
      const result = await channel.send({
        type: 'broadcast',
        event: REMOVED_EVENT,
        payload: { id, by: currentDevice.name, senderId: currentDevice.id },
      })

      if (result !== 'ok') {
        throw userError('Could not remove the item on the other device.')
      }
    },

    updateDevice: async (nextDevice) => {
      currentDevice = nextDevice
      await channel.track({ device: nextDevice })
    },

    close: async () => {
      intentionallyClosed = true
      clearInterval(keepAliveTimer)
      try {
        await channel.untrack()
      } catch {
        /* already gone */
      }

      await supabase.removeChannel(channel)
    },
  }
}
