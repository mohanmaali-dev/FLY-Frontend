import { useEffect, useRef, useState } from 'react'
import { FiAlertTriangle } from 'react-icons/fi'

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Must match the duration of the transition classes below, or the dialog is
// torn out of the DOM mid-animation.
const EXIT_MS = 180

/**
 * Confirmation for actions that cannot be undone.
 *
 * Deliberate defaults: focus lands on Cancel, not Confirm, so a stray Enter
 * dismisses rather than destroys; Escape and a backdrop click both cancel; and
 * focus is trapped inside and returned to the trigger on close.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  consequences = [],
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  busyLabel = 'Working...',
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const triggerRef = useRef(null)

  // `mounted` keeps the node alive through the closing animation; `shown`
  // drives the transition. Flipping both at once would skip the animation,
  // because the element would mount already in its final state.
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)

      // Two frames: one for the browser to paint the closed state, one to
      // transition away from it.
      let inner
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true))
      })

      return () => {
        cancelAnimationFrame(outer)
        if (inner) cancelAnimationFrame(inner)
      }
    }

    setShown(false)
    const timer = setTimeout(() => setMounted(false), EXIT_MS)

    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return

    // Remember what had focus so it can be restored when the dialog closes.
    triggerRef.current = document.activeElement
    const focusTimer = setTimeout(() => cancelRef.current?.focus(), 20)

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll(FOCUSABLE)
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    // Stop the page behind the dialog from scrolling.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      triggerRef.current?.focus?.()
    }
  }, [open, busy, onCancel])

  if (!mounted) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-[2px] transition-opacity duration-200 ease-out sm:items-center ${
        shown ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={() => !busy && onCancel()}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        onClick={(event) => event.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border border-line bg-card p-5 shadow-2xl shadow-ink/10 transition-all duration-200 ease-out sm:p-6 ${
          shown
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-6 scale-[0.97] opacity-0 sm:translate-y-3'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <FiAlertTriangle size={19} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-semibold text-ink">
              {title}
            </h2>
            <p id="confirm-description" className="mt-1 text-sm leading-relaxed text-ink-soft">
              {description}
            </p>
          </div>
        </div>

        {consequences.length > 0 && (
          <ul className="mt-4 space-y-1.5 rounded-xl bg-surface p-3.5">
            {consequences.map((line) => (
              <li key={line} className="flex gap-2.5 text-xs leading-relaxed text-ink-soft">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-mute"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-surface disabled:opacity-50 sm:py-2"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 sm:py-2"
          >
            {busy && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
