import { useEffect, useRef, useState } from 'react'
import {
  FiArrowDownLeft,
  FiArrowUpRight,
  FiCheck,
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiFile,
  FiImage,
  FiLink,
  FiMaximize2,
  FiMessageCircle,
  FiMusic,
  FiVideo,
} from 'react-icons/fi'

import ImageLightbox from './ImageLightbox.jsx'
import { useToast } from './Toast.jsx'
import { copyText } from '../utils/browser.js'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getFileIcon(mimeType = '') {
  if (mimeType.startsWith('image/')) return <FiImage size={16} />
  if (mimeType.startsWith('video/')) return <FiVideo size={16} />
  if (mimeType.startsWith('audio/')) return <FiMusic size={16} />
  return <FiFile size={16} />
}

function getFileTypeLabel(mimeType = '') {
  if (!mimeType) return 'File'
  if (mimeType.startsWith('image/')) return 'Image'
  if (mimeType.startsWith('video/')) return 'Video'
  if (mimeType.startsWith('audio/')) return 'Audio'
  if (mimeType === 'application/pdf') return 'PDF document'
  return mimeType.split('/')[1]?.toUpperCase() || 'File'
}

export function SharedItemsList({ items = [] }) {
  const [copiedId, setCopiedId] = useState(null)
  const [previewItem, setPreviewItem] = useState(null)
  const listRef = useRef(null)
  const { toast } = useToast()

  const newestItemId = items?.[0]?.id

  useEffect(() => {
    if (!newestItemId) return
    listRef.current?.parentElement?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [newestItemId])

  const copyToClipboard = async (text, itemId) => {
    if (!(await copyText(text))) return

    setCopiedId(itemId)
    setTimeout(() => setCopiedId(null), 2000)
    toast({ tone: 'success', title: 'Copied to clipboard', duration: 2500 })
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface/70 px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent-line bg-accent-soft text-accent">
          <FiMessageCircle size={20} aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-sm font-semibold text-ink">No transfers yet</h3>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-mute">
          Send text, a link or a file from either connected device.
        </p>
      </div>
    )
  }

  return (
    <div ref={listRef} className="space-y-4">
        {items.map((item, index) => {
          const itemId = item.id || `item-${index}`
          const isYou = item.sender === 'You'
          const isText = item.itemType === 'text' || (!item.itemType && item.text && !item.url && !item.fileUrl)
          const isLink = item.itemType === 'link' || item.url
          const isFile = item.itemType === 'file' || item.fileUrl

          return (
            <div
              key={itemId}
              className="animate-rise w-full rounded-xl border border-line bg-surface shadow-[var(--shadow-card)] transition hover:border-line-strong"
            >
              {/* Direction is carried by one small icon and the sender name —
                  it does not need its own tinted bar. */}
              <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
                <div className="flex min-w-0 items-center gap-2">
                  {isYou ? (
                    <FiArrowUpRight className="shrink-0 text-ink-mute" size={15} />
                  ) : (
                    <FiArrowDownLeft className="shrink-0 text-ok" size={15} />
                  )}
                  <span className="truncate text-sm font-medium text-ink">
                    {isYou ? 'You' : item.sender}
                  </span>
                </div>

                <time dateTime={item.timestamp || undefined} className="shrink-0 text-xs text-ink-mute">
                  {item.timestamp
                    ? new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Just now'}
                </time>
              </div>

              {/* Item Content Area */}
              <div className="px-4 pb-4 pt-3">
                {/* 1. TEXT */}
                {isText && (
                  <div>
                    <p className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink">
                      {item.text}
                    </p>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.text, itemId)}
                        aria-label="Copy shared text"
                        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft shadow-[var(--shadow-card)] transition hover:text-ink"
                      >
                        {copiedId === itemId ? (
                          <>
                            <FiCheck size={13} className="text-ok" />
                            <span className="text-ok">Copied</span>
                          </>
                        ) : (
                          <>
                            <FiCopy size={13} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. LINK */}
                {isLink && (
                  <div>
                    {item.text && (
                      <p className="mb-2.5 text-sm text-ink-soft">{item.text}</p>
                    )}

                    <div className="flex items-center justify-between rounded-xl border border-line bg-surface/90 p-2.5">
                      <div className="min-w-0 flex-1 pr-2">
                        {/* min-w-0 all the way down: without it the nowrap URL
                            sets a min-content floor and overflows the card. */}
                        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
                          <FiLink size={14} className="shrink-0 text-ink-mute" />
                          <span className="min-w-0 truncate">{item.url}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.url, itemId)}
                          aria-label="Copy shared link"
                          className="rounded-md border border-line bg-card p-1.5 text-ink-soft transition hover:text-ink"
                          title="Copy link"
                        >
                          {copiedId === itemId ? (
                            <FiCheck size={13} className="text-ok" />
                          ) : (
                            <FiCopy size={13} />
                          )}
                        </button>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-[var(--shadow-button)] transition active:scale-[0.97] hover:bg-accent-hover"
                        >
                          <span>Open</span>
                          <FiExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. FILE */}
                {isFile && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3 rounded-lg border border-line bg-raised p-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent-line bg-accent-soft text-accent">
                        {getFileIcon(item.mimeType)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {item.fileName || 'Shared file'}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-ink-mute">
                          {getFileTypeLabel(item.mimeType)} · {formatBytes(item.fileSize)}
                        </p>
                      </div>

                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={item.fileName}
                        aria-label={`Download ${item.fileName || 'file'}`}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white shadow-[var(--shadow-button)] transition active:scale-[0.97] hover:bg-accent-hover"
                      >
                        <FiDownload size={14} />
                        <span className="hidden sm:inline">Download</span>
                      </a>
                    </div>

                    {/* A short thumbnail — a full-height crop of every image
                        made the feed unreadable. Click opens the real thing. */}
                    {item.mimeType && item.mimeType.startsWith('image/') && (
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        aria-label={`View ${item.fileName || 'image'} full size`}
                        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-lg border border-line"
                      >
                        <img
                          src={item.fileUrl}
                          alt={item.fileName}
                          className="h-40 w-full object-cover transition duration-300 group-hover:scale-[1.03] sm:h-48"
                          loading="lazy"
                        />

                        <span className="absolute inset-0 flex items-center justify-center bg-ink/0 transition group-hover:bg-ink/35">
                          <span className="flex items-center gap-1.5 rounded-lg bg-surface/95 px-2.5 py-1.5 text-xs font-medium text-ink opacity-0 shadow-[var(--shadow-card)] transition group-hover:opacity-100">
                            <FiMaximize2 size={13} />
                            View full size
                          </span>
                        </span>
                      </button>
                    )}

                    {item.mimeType && item.mimeType.startsWith('video/') && (
                      <video
                        src={item.fileUrl}
                        controls
                        preload="metadata"
                        className="max-h-64 w-full rounded-lg border border-line bg-ink"
                      >
                        Your browser does not support video preview.
                      </video>
                    )}

                    {item.mimeType && item.mimeType.startsWith('audio/') && (
                      <audio
                        src={item.fileUrl}
                        controls
                        preload="metadata"
                        className="w-full"
                      >
                        Your browser does not support audio preview.
                      </audio>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

      <ImageLightbox item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  )
}
