import { useState } from 'react'
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
  FiMessageSquare,
  FiMusic,
  FiVideo,
} from 'react-icons/fi'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatTime(timestamp) {
  if (!timestamp) return 'Just now'
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Just now'
  }
}

function getFileIcon(mimeType = '') {
  if (mimeType.startsWith('image/')) return <FiImage size={16} />
  if (mimeType.startsWith('video/')) return <FiVideo size={16} />
  if (mimeType.startsWith('audio/')) return <FiMusic size={16} />
  return <FiFile size={16} />
}

function detectType(item) {
  const isFile = item.itemType === 'file' || !!item.fileUrl
  if (isFile) return 'file'
  const isLink = item.itemType === 'link' || (!!item.url && !item.fileUrl)
  if (isLink) return 'link'
  return 'text'
}

const TYPE_META = {
  text: { label: 'Text', classes: 'bg-ink-50 text-ink-600 border-border' },
  link: { label: 'Link', classes: 'bg-primary-50 text-primary-dark border-primary-100' },
  file: { label: 'File', classes: 'bg-ink-100 text-ink-700 border-border' },
}

export function SharedItemsList({ items = [] }) {
  const [copiedId, setCopiedId] = useState(null)

  const copyToClipboard = (text, itemId) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(itemId)
    setTimeout(() => setCopiedId(null), 1800)
  }

  if (!items || items.length === 0) {
    return (
      <div className="surface px-5 py-10 text-center sm:px-8 sm:py-14">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-ink-50 text-ink-500 ring-1 ring-inset ring-border">
          <FiMessageSquare size={18} />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-ink-800">
          No shared activity yet
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-ink-500">
          Content sent or received in this session appears here. History is saved
          locally on your device.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between px-0.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Activity
        </h3>
        <span className="badge bg-ink-50 text-ink-600 border border-border tabular-nums">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {items.map((item, index) => {
          const itemId = item.id || `item-${index}`
          const isYou = item.sender === 'You'
          const type = detectType(item)
          const meta = TYPE_META[type]

          return (
            <article
              key={itemId}
              className={`overflow-hidden rounded-[10px] border transition-colors ${
                isYou
                  ? 'border-primary-100 bg-primary-50/30'
                  : 'border-border bg-white'
              }`}
            >
              {/* Header */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border-soft px-4 py-2.5 sm:px-5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                      isYou
                        ? 'bg-primary-50 text-primary-dark'
                        : 'bg-ink-50 text-ink-500'
                    }`}
                  >
                    {isYou ? (
                      <FiArrowUpRight size={11} strokeWidth={2.2} />
                    ) : (
                      <FiArrowDownLeft size={11} strokeWidth={2.2} />
                    )}
                  </span>
                  <p className="truncate text-[13px] font-medium leading-tight text-ink-700">
                    {isYou ? (
                      <span className="text-primary-dark font-semibold">
                        Sent by you
                      </span>
                    ) : (
                      <>
                        Received from{' '}
                        <span className="font-semibold text-ink-800">
                          {item.sender || 'Unknown device'}
                        </span>
                      </>
                    )}
                  </p>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <span
                    className={`badge border ${meta.classes}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[11px] tabular-nums text-ink-400">
                    {formatTime(item.timestamp)}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 py-4 sm:px-5 sm:py-5">
                {/* TEXT */}
                {type === 'text' && (
                  <div>
                    <p className="whitespace-pre-wrap break-words text-[14px] leading-7 text-ink-800 sm:text-[15px]">
                      {item.text}
                    </p>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.text, itemId)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 transition hover:bg-ink-50 active:scale-[0.99]"
                      >
                        {copiedId === itemId ? (
                          <>
                            <FiCheck size={13} className="text-primary" />
                            <span className="text-primary-dark">Copied</span>
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

                {/* LINK */}
                {type === 'link' && (
                  <div className="space-y-3">
                    {item.text && (
                      <p className="text-[13px] font-medium text-ink-600">
                        {item.text}
                      </p>
                    )}

                    <div className="flex flex-col gap-3 rounded-[10px] border border-border-soft bg-ink-50 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-ink-500 ring-1 ring-border">
                            <FiLink size={15} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-ink-800 sm:text-sm">
                              {item.url}
                            </p>
                            <p className="mt-0.5 text-[11px] text-ink-400">
                              {(() => {
                                try {
                                  return new URL(item.url).hostname
                                } catch {
                                  return ''
                                }
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 sm:flex-nowrap">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.url, itemId)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-white px-3 py-2 text-[12px] font-medium text-ink-700 transition hover:bg-ink-50 sm:flex-none active:scale-[0.99]"
                          title="Copy Link"
                        >
                          {copiedId === itemId ? (
                            <>
                              <FiCheck size={13} className="text-primary" />
                              <span className="text-primary-dark">Copied</span>
                            </>
                          ) : (
                            <>
                              <FiCopy size={13} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-ink-900 px-3.5 py-2 text-[12px] font-medium text-white transition hover:bg-ink-800 sm:flex-none active:scale-[0.99]"
                        >
                          <span>Open</span>
                          <FiExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* FILE */}
                {type === 'file' && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 rounded-[10px] border border-border-soft bg-ink-50 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white text-ink-600 ring-1 ring-border">
                          {getFileIcon(item.mimeType)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink-800 sm:text-sm">
                            {item.fileName || 'Shared file'}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-ink-500">
                            {formatBytes(item.fileSize)}
                            {item.mimeType ? (
                              <span className="mx-1 text-ink-300">·</span>
                            ) : null}
                            {item.mimeType ? (
                              <span className="mono uppercase tracking-wide text-[10px]">
                                {item.mimeType.split('/')[1]?.slice(0, 6) ||
                                  item.mimeType}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={item.fileName}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-ink-900 px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-ink-800 active:scale-[0.99] sm:py-2"
                      >
                        <FiDownload size={13} />
                        <span>Download</span>
                      </a>
                    </div>

                    {item.mimeType && item.mimeType.startsWith('image/') && (
                      <div className="overflow-hidden rounded-[10px] border border-border bg-white">
                        <img
                          src={item.fileUrl}
                          alt={item.fileName}
                          className="max-h-80 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
