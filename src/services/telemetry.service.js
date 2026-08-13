const endpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT || ''

const ALLOWED_EVENTS = new Set([
  'app_error',
  'pairing_connected',
  'pairing_failed',
  'page_performance',
  'reconnect_failed',
  'transfer_failed',
  'upload_failed',
])

const routeGroup = () => {
  const path = window.location.pathname
  if (path.startsWith('/pair/')) return '/pair/:id'
  return path.slice(0, 80)
}

const safeProperties = (properties) =>
  Object.fromEntries(
    Object.entries(properties)
      .slice(0, 8)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [key.slice(0, 32), typeof value === 'string' ? value.slice(0, 80) : value]),
  )

export const recordEvent = (name, properties = {}) => {
  if (!endpoint || !ALLOWED_EVENTS.has(name)) return

  const body = JSON.stringify({
    name,
    route: routeGroup(),
    properties: safeProperties(properties),
    occurredAt: new Date().toISOString(),
  })

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
      return
    }
    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* Monitoring must never interrupt sharing. */
  }
}

export const installGlobalMonitoring = () => {
  const onError = (event) => recordEvent('app_error', {
    source: 'window',
    errorName: event.error?.name || 'Error',
  })
  const onRejection = (event) => recordEvent('app_error', {
    source: 'promise',
    errorName: event.reason?.name || 'UnhandledRejection',
  })

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  const reportPerformance = () => {
    const navigation = performance.getEntriesByType?.('navigation')?.[0]
    if (!navigation) return

    recordEvent('page_performance', {
      loadMs: Math.round(navigation.loadEventEnd || performance.now()),
      domReadyMs: Math.round(navigation.domContentLoadedEventEnd || 0),
      navigationType: navigation.type || 'navigate',
      online: navigator.onLine,
    })
  }

  if (document.readyState === 'complete') {
    setTimeout(reportPerformance, 0)
  } else {
    window.addEventListener('load', reportPerformance, { once: true })
  }

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    window.removeEventListener('load', reportPerformance)
  }
}
