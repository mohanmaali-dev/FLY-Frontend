import { useEffect, useRef, useState } from 'react'
import { FiDownload, FiX } from 'react-icons/fi'

// Must match the transition duration below, or the node is torn out mid-fade.
const EXIT_MS = 180

function formatBytes(bytes) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${parseFloat((bytes / 1024 ** index).toFixed(1))} ${units[index]}`
}

/**
 * Full-size view for an image shared in the session.
 *
 * The feed only shows a short thumbnail — a 240px crop of every image made the
 * activity list unreadable once a few had arrived. The full picture lives here.
 */
export function ImageLightbox({ item, onClose }) {
  const closeRef = useRef(null)

  // `mounted` keeps the node alive through the closing fade; `shown` drives it.
  const [mounted, setMounted] = useState(Boolean(item))
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (item) {
      setMounted(true)

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
  }, [item])

  useEffect(() => {
    if (!item) return

    const previouslyFocused = document.activeElement
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 20)

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [item, onClose])

  if (!mounted || !item) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.fileName || 'Shared image'}
      onClick={onClose}
      className={`fixed inset-0 z-50 flex flex-col bg-ink/90 backdrop-blur-sm transition-opacity duration-200 ${
        shown ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Toolbar */}
      <div
        className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {item.fileName || 'Shared image'}
          </p>
          {item.fileSize ? (
            <p className="mt-0.5 text-xs text-white/60">{formatBytes(item.fileSize)}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={item.fileUrl}
            download={item.fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <FiDownload size={15} />
            <span className="hidden sm:inline">Download</span>
          </a>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close image"
            className="flex items-center justify-center rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <FiX size={18} />
          </button>
        </div>
      </div>

      {/* Image. object-contain so nothing is cropped, unlike the thumbnail. */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8">
        <img
          src={item.fileUrl}
          alt={item.fileName || 'Shared image'}
          onClick={(event) => event.stopPropagation()}
          className={`max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-transform duration-200 ${
            shown ? 'scale-100' : 'scale-95'
          }`}
        />
      </div>

      <p className="shrink-0 pb-4 text-center text-xs text-white/50">
        Click anywhere or press Esc to close
      </p>
    </div>
  )
}

export default ImageLightbox
