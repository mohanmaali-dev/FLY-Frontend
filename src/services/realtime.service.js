import { supabase } from './supabase.js'
import { toUserMessage, userError } from '../utils/errors.js'
import { touchPairingSession } from './pairing.service.js'

const MESSAGE_EVENT = 'device:message'
const ENDED_EVENT = 'pairing:ended'

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
  onError,
}) => {
  const channel = supabase.channel(channelName(sessionId), {
    config: {
      presence: { key: device.id },
      // Never echo our own broadcast back; both callers append optimistically.
      broadcast: { self: false },
    },
  })

  channel.on('presence', { event: 'sync' }, () => {
    const devices = Object.values(channel.presenceState())
      .map((entries) => entries[0]?.device)
      .filter(Boolean)

    onDevices?.(devices)

    // Keeps `status` accurate and pushes out expiry while devices are attached,
    // so an active pairing is never expired out from under its devices.
    touchPairingSession(sessionId, devices.length).catch(() => {
      /* advisory only — a failure here must not drop the connection */
    })
  })

  channel.on('broadcast', { event: MESSAGE_EVENT }, ({ payload }) => {
    if (payload) onMessage?.(payload)
  })

  // Either side can end the session. Without this the other device keeps a
  // history full of links to files that have just been deleted.
  channel.on('broadcast', { event: ENDED_EVENT }, ({ payload }) => {
    onEnded?.(payload?.by || 'The other device')
  })

  channel.subscribe((status, error) => {
    if (status === 'SUBSCRIBED') {
      channel.track({ device })
      return
    }

    if (status === 'CHANNEL_ERROR') {
      onError?.(toUserMessage(error, 'Connection lost. Trying to reconnect.'))
      return
    }

    if (status === 'TIMED_OUT') {
      onError?.('Connection timed out. Check your network and reload.')
    }
  })

  return {
    channel,

    send: async (payloadData) => {
      const payload =
        typeof payloadData === 'string'
          ? { itemType: 'text', text: payloadData }
          : payloadData

      const message = {
        id: payload.id || randomId(),
        itemType: payload.itemType || 'text',
        text: payload.text || '',
        url: payload.url || '',
        fileName: payload.fileName || '',
        fileUrl: payload.fileUrl || '',
        fileSize: payload.fileSize || 0,
        mimeType: payload.mimeType || '',
        sender: device.name,
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
          payload: { by: device.name },
        })
      } catch {
        /* the other side falls back to noticing the presence drop */
      }
    },

    close: async () => {
      try {
        await channel.untrack()
      } catch {
        /* already gone */
      }

      await supabase.removeChannel(channel)
    },
  }
}
