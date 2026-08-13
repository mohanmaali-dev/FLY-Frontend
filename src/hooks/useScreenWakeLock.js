import { useCallback, useEffect, useRef, useState } from 'react'

export function useScreenWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [enabled, setEnabled] = useState(false)
  const [active, setActive] = useState(false)
  const lockRef = useRef(null)
  const enabledRef = useRef(false)

  const requestLock = useCallback(async () => {
    if (!supported || document.visibilityState !== 'visible' || lockRef.current) return

    const lock = await navigator.wakeLock.request('screen')
    lockRef.current = lock
    setActive(true)
    lock.addEventListener('release', () => {
      if (lockRef.current === lock) {
        lockRef.current = null
        setActive(false)
      }
    }, { once: true })
  }, [supported])

  const enable = useCallback(async () => {
    enabledRef.current = true
    setEnabled(true)
    try {
      await requestLock()
    } catch (error) {
      enabledRef.current = false
      setEnabled(false)
      throw error
    }
  }, [requestLock])

  const disable = useCallback(async () => {
    enabledRef.current = false
    setEnabled(false)
    const lock = lockRef.current
    lockRef.current = null
    setActive(false)
    await lock?.release().catch(() => {})
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (enabledRef.current && document.visibilityState === 'visible') {
        requestLock().catch(() => {
          enabledRef.current = false
          setEnabled(false)
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [requestLock])

  useEffect(() => () => {
    enabledRef.current = false
    lockRef.current?.release().catch(() => {})
  }, [])

  return { supported, enabled, active, enable, disable }
}
