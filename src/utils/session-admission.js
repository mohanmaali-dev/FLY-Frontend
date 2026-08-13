export const MAX_SESSION_DEVICES = 2

export const selectSessionDevices = (devices) =>
  [...devices]
    .sort((left, right) => {
      if (left.role === 'host' && right.role !== 'host') return -1
      if (right.role === 'host' && left.role !== 'host') return 1
      return (left.joinedAt || 0) - (right.joinedAt || 0) || left.id.localeCompare(right.id)
    })
    .slice(0, MAX_SESSION_DEVICES)
