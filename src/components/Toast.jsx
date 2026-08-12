/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { FiAlertTriangle, FiCheck, FiInfo, FiX } from 'react-icons/fi'

const ToastContext = createContext(null)

const TONES = {
  info: { icon: FiInfo, className: 'border-line bg-surface text-ink-soft' },
  success: { icon: FiCheck, className: 'border-ok-line bg-ok-soft text-ok' },
  warning: { icon: FiAlertTriangle, className: 'border-warn-line bg-warn-soft text-warn' },
  error: { icon: FiAlertTriangle, className: 'border-danger-line bg-danger-soft text-danger' },
}

const EXIT_MS = 200

function Toast({ toast, onDismiss }) {
  const { icon: Icon, className } = TONES[toast.tone] || TONES.info

  const [shown, setShown] = useState(false)

  useEffect(() => {
    // Two frames so the browser paints the hidden state before transitioning.
    let inner
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(true))
    })

    return () => {
      cancelAnimationFrame(outer)
      if (inner) cancelAnimationFrame(inner)
    }
  }, [])

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-surface p-3.5 shadow-[var(--shadow-raised)] transition-all duration-200 ease-out ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${className}`}
      >
        <Icon size={15} />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium text-ink">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {toast.description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 shrink-0 rounded-lg p-1 text-ink-mute transition hover:bg-raised hover:text-ink"
      >
        <FiX size={16} />
      </button>
    </div>
  )
}

/**
 * Transient notifications.
 *
 * Events like "the other device left" were previously written into the page's
 * error banner, where they sat forever describing something that had already
 * finished. A toast says it once and gets out of the way.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }

    setToasts((current) => current.filter((entry) => entry.id !== id))
  }, [])

  const toast = useCallback(
    ({ title, description, tone = 'info', duration = 6000 }) => {
      idRef.current += 1
      const id = idRef.current

      setToasts((current) => [...current, { id, title, description, tone }])

      if (duration) {
        timersRef.current.set(
          id,
          setTimeout(() => dismiss(id), duration + EXIT_MS),
        )
      }

      return id
    },
    [dismiss],
  )

  // Clear pending timers if the provider unmounts mid-flight.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}

      <div
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
      >
        <div className="flex w-full max-w-sm flex-col gap-2">
          {toasts.map((entry) => (
            <Toast key={entry.id} toast={entry} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be inside ToastProvider')
  }

  return context
}

export default ToastProvider
