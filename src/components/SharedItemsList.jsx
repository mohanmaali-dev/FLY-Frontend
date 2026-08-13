import { useEffect, useMemo, useRef, useState } from 'react'
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
  FiRefreshCw,
  FiSearch,
  FiShare2,
  FiTrash2,
  FiVideo,
} from 'react-icons/fi'

import ImageLightbox from './ImageLightbox.jsx'
import { useToast } from './Toast.jsx'
import { copyText } from '../utils/browser.js'
import { refreshPairingFileUrl } from '../services/storage.service.js'

const TRANSFER_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'text', label: 'Text' },
  { id: 'link', label: 'Links' },
  { id: 'file', label: 'Files' },
]

const getItemType = (item) => {
  if (item.itemType) return item.itemType
  if (item.fileUrl) return 'file'
  if (item.url) return 'link'
  return 'text'
}

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

export function SharedItemsList({ items = [], onRetryItem, onRemoveItem }) {
  const [copiedId, setCopiedId] = useState(null)
  const [previewItem, setPreviewItem] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [directionFilter, setDirectionFilter] = useState('all')
  const [resolvedUrls, setResolvedUrls] = useState({})
  const [downloadingAll, setDownloadingAll] = useState(false)
  const listRef = useRef(null)
  const { toast } = useToast()

  const newestItemId = items?.[0]?.id

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      const isYou = item.sender === 'You'
      const typeMatches = typeFilter === 'all' || getItemType(item) === typeFilter
      const directionMatches =
        directionFilter === 'all' ||
        (directionFilter === 'sent' ? isYou : !isYou)
      const searchable = [item.text, item.url, item.fileName, item.sender]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return typeMatches && directionMatches && (!needle || searchable.includes(needle))
    })
  }, [directionFilter, items, query, typeFilter])

  const visibleFiles = filteredItems.filter((item) => getItemType(item) === 'file')

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

  const retryItem = async (item) => {
    if (!onRetryItem || busyId) return
    setBusyId(item.id)
    try {
      await onRetryItem(item.id)
      toast({ tone: 'success', title: 'Transfer sent again' })
    } catch {
      toast({ tone: 'error', title: 'Retry failed', description: 'Check the connection and try again.' })
    } finally {
      setBusyId(null)
    }
  }

  const removeItem = async (item) => {
    if (!onRemoveItem || busyId) return
    setBusyId(item.id)
    try {
      await onRemoveItem(item.id)
      toast({ tone: 'success', title: item.fileUrl ? 'File deleted' : 'Transfer removed' })
    } catch {
      toast({ tone: 'error', title: 'Could not remove transfer' })
    } finally {
      setBusyId(null)
    }
  }

  const resolveFileUrl = async (item) => {
    if (!item.storagePath) return item.fileUrl
    const freshUrl = await refreshPairingFileUrl(item.storagePath)
    setResolvedUrls((current) => ({ ...current, [item.id]: freshUrl }))
    return freshUrl
  }

  const startDownload = (url, fileName) => {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName || 'shared-file'
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const downloadItem = async (item) => {
    if (busyId) return
    setBusyId(item.id)
    try {
      startDownload(await resolveFileUrl(item), item.fileName)
    } catch {
      toast({ tone: 'error', title: 'Download link expired', description: 'Reconnect to the live session and try again.' })
    } finally {
      setBusyId(null)
    }
  }

  const downloadVisibleFiles = async () => {
    if (!visibleFiles.length || downloadingAll) return
    setDownloadingAll(true)
    let started = 0

    for (const item of visibleFiles) {
      try {
        startDownload(await resolveFileUrl(item), item.fileName)
        started += 1
      } catch {
        /* continue with the remaining files */
      }
    }

    toast({
      tone: started ? 'success' : 'error',
      title: started ? `${started} ${started === 1 ? 'download' : 'downloads'} started` : 'Downloads could not start',
      description: started > 1 ? 'Your browser may ask permission for multiple downloads.' : '',
    })
    setDownloadingAll(false)
  }

  const shareItem = async (item) => {
    if (typeof navigator.share !== 'function' || busyId) return
    const isLink = getItemType(item) === 'link'
    const data = isLink
      ? { title: item.text || 'Shared link', url: item.url }
      : { title: 'Shared with FLY', text: item.text }

    setBusyId(item.id)
    try {
      await navigator.share(data)
    } catch (error) {
      if (error?.name !== 'AbortError') {
        toast({ tone: 'warning', title: 'Could not open sharing', description: 'Copy the item and try again.' })
      }
    } finally {
      setBusyId(null)
    }
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
      <div className="rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-card)]">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={14} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search transfers" aria-label="Search transfers" className="w-full rounded-lg border border-line-strong bg-raised py-2 pl-9 pr-3 text-sm text-ink placeholder-ink-mute" />
        </div>
        <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Filter by transfer type">
            {TRANSFER_FILTERS.map((filter) => (
              <button key={filter.id} type="button" aria-pressed={typeFilter === filter.id} onClick={() => setTypeFilter(filter.id)} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${typeFilter === filter.id ? 'bg-accent-soft text-accent-hover' : 'text-ink-mute hover:bg-raised hover:text-ink'}`}>{filter.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)} aria-label="Filter by transfer direction" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-soft sm:flex-none">
              <option value="all">Sent & received</option>
              <option value="sent">Sent by me</option>
              <option value="received">Received</option>
            </select>
            {visibleFiles.length > 0 && (
              <button type="button" onClick={downloadVisibleFiles} disabled={downloadingAll} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-line-strong hover:text-ink disabled:opacity-50"><FiDownload size={12} />{downloadingAll ? 'Preparing…' : `Download ${visibleFiles.length}`}</button>
            )}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{filteredItems.length} transfers shown</p>

      {filteredItems.length === 0 && (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface/70 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-ink">No matching transfers</p>
          <p className="mt-1 text-xs text-ink-mute">Change the search or filters to see more activity.</p>
        </div>
      )}

        {filteredItems.map((item, index) => {
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
                  {isYou && item.deliveryStatus && (
                    <span className={`text-[0.68rem] font-medium ${item.deliveryStatus === 'failed' ? 'text-danger' : item.deliveryStatus === 'delivered' ? 'text-ok' : 'text-ink-mute'}`}>
                      {item.deliveryStatus === 'sending' ? 'Sending…' : item.deliveryStatus === 'sent' ? 'Sent' : item.deliveryStatus === 'delivered' ? 'Delivered' : 'Failed'}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <time dateTime={item.timestamp || undefined} className="text-xs text-ink-mute">
                    {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </time>
                  {isYou && item.deliveryStatus === 'failed' && onRetryItem && (
                    <button type="button" onClick={() => retryItem(item)} disabled={busyId === itemId} aria-label="Retry failed transfer" title="Retry" className="rounded-md p-1.5 text-danger transition hover:bg-danger-soft disabled:opacity-50"><FiRefreshCw size={13} className={busyId === itemId ? 'animate-spin' : ''} /></button>
                  )}
                  {onRemoveItem && (
                    <button type="button" onClick={() => removeItem(item)} disabled={busyId === itemId} aria-label={`Remove ${item.fileName || 'transfer'}`} title={item.fileUrl ? 'Delete file and remove' : 'Remove transfer'} className="rounded-md p-1.5 text-ink-mute transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"><FiTrash2 size={13} /></button>
                  )}
                </div>
              </div>

              {/* Item Content Area */}
              <div className="px-4 pb-4 pt-3">
                {/* 1. TEXT */}
                {isText && (
                  <div>
                    <p className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink">
                      {item.text}
                    </p>

                    <div className="mt-3 flex justify-end gap-2">
                      {typeof navigator.share === 'function' && (
                        <button
                          type="button"
                          onClick={() => shareItem(item)}
                          aria-label="Share text with another app"
                          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft shadow-[var(--shadow-card)] transition hover:text-ink"
                        >
                          <FiShare2 size={13} />
                          <span>Share</span>
                        </button>
                      )}
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
                        {typeof navigator.share === 'function' && (
                          <button
                            type="button"
                            onClick={() => shareItem(item)}
                            aria-label="Share link with another app"
                            className="rounded-md border border-line bg-surface p-1.5 text-ink-soft transition hover:text-ink"
                            title="Share link"
                          >
                            <FiShare2 size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.url, itemId)}
                          aria-label="Copy shared link"
                          className="rounded-md border border-line bg-surface p-1.5 text-ink-soft transition hover:text-ink"
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

                      <button
                        type="button"
                        onClick={() => downloadItem(item)}
                        disabled={busyId === itemId}
                        aria-label={`Download ${item.fileName || 'file'}`}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white shadow-[var(--shadow-button)] transition active:scale-[0.97] hover:bg-accent-hover disabled:opacity-60"
                      >
                        <FiDownload size={14} className={busyId === itemId ? 'animate-pulse' : ''} />
                        <span className="hidden sm:inline">Download</span>
                      </button>
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
                          src={resolvedUrls[itemId] || item.fileUrl}
                          alt={item.fileName}
                          className="h-40 w-full object-cover transition duration-300 group-hover:scale-[1.03] sm:h-48"
                          loading="lazy"
                          onError={() => {
                            if (!resolvedUrls[itemId] && item.storagePath) {
                              resolveFileUrl(item).catch(() => {})
                            }
                          }}
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
                        src={resolvedUrls[itemId] || item.fileUrl}
                        controls
                        preload="metadata"
                        className="max-h-64 w-full rounded-lg border border-line bg-ink"
                      >
                        Your browser does not support video preview.
                      </video>
                    )}

                    {item.mimeType && item.mimeType.startsWith('audio/') && (
                      <audio
                        src={resolvedUrls[itemId] || item.fileUrl}
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

      <ImageLightbox item={previewItem ? { ...previewItem, fileUrl: resolvedUrls[previewItem.id] || previewItem.fileUrl } : null} onClose={() => setPreviewItem(null)} />
    </div>
  )
}
