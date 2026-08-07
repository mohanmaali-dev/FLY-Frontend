import { useState } from 'react'
import {
  FiArrowDownLeft,
  FiArrowUpRight,
  FiCheck,
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiFile,
  FiFileText,
  FiImage,
  FiLink,
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

function getFileIcon(mimeType = '') {
  if (mimeType.startsWith('image/')) return <FiImage size={16} />
  if (mimeType.startsWith('video/')) return <FiVideo size={16} />
  if (mimeType.startsWith('audio/')) return <FiMusic size={16} />
  return <FiFile size={16} />
}

export function SharedItemsList({ items = [] }) {
  const [copiedId, setCopiedId] = useState(null)

  const copyToClipboard = (text, itemId) => {
    navigator.clipboard.writeText(text)
    setCopiedId(itemId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <FiFileText size={18} />
        </div>
        <h3 className="mt-3 text-xs font-semibold text-slate-800">No shared activity yet</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Content sent or received in this session will appear here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Activity Feed ({items.length})
        </h3>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const itemId = item.id || `item-${index}`
          const isYou = item.sender === 'You'
          const isText = item.itemType === 'text' || (!item.itemType && item.text && !item.url && !item.fileUrl)
          const isLink = item.itemType === 'link' || item.url
          const isFile = item.itemType === 'file' || item.fileUrl

          return (
            <div
              key={itemId}
              className={`rounded-xl border bg-white shadow-2xs transition overflow-hidden ${
                isYou
                  ? 'border-indigo-200/70'
                  : 'border-slate-200'
              }`}
            >
              {/* Header Bar */}
              <div
                className={`flex items-center justify-between px-3.5 py-2 text-xs border-b ${
                  isYou
                    ? 'bg-indigo-50/60 border-indigo-100 text-indigo-900'
                    : 'bg-slate-50 border-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {isYou ? (
                    <>
                      <FiArrowUpRight className="text-indigo-600" size={14} />
                      <span className="font-semibold text-indigo-900">Sent by You</span>
                    </>
                  ) : (
                    <>
                      <FiArrowDownLeft className="text-slate-600" size={14} />
                      <span className="font-semibold text-slate-900">Received from {item.sender}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>
                    {item.timestamp
                      ? new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </span>
                  <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] uppercase font-bold text-slate-600 border border-slate-200">
                    {isLink ? 'Link' : isFile ? 'File' : 'Text'}
                  </span>
                </div>
              </div>

              {/* Item Content Area */}
              <div className="p-3.5">
                {/* 1. TEXT */}
                {isText && (
                  <div>
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-800 leading-relaxed font-sans">
                      {item.text}
                    </p>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.text, itemId)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                      >
                        {copiedId === itemId ? (
                          <>
                            <FiCheck size={13} className="text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
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
                      <p className="text-xs font-medium text-slate-700 mb-2">{item.text}</p>
                    )}

                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 text-slate-900 font-medium text-xs">
                          <FiLink size={14} className="shrink-0 text-slate-500" />
                          <span className="truncate">{item.url}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.url, itemId)}
                          className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:text-slate-900 transition"
                          title="Copy Link"
                        >
                          {copiedId === itemId ? (
                            <FiCheck size={13} className="text-emerald-600" />
                          ) : (
                            <FiCopy size={13} />
                          )}
                        </button>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition"
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
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700">
                          {getFileIcon(item.mimeType)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {item.fileName || 'Shared file'}
                          </p>
                          <p className="text-[11px] text-slate-500">{formatBytes(item.fileSize)}</p>
                        </div>
                      </div>

                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={item.fileName}
                        className="flex shrink-0 items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition"
                      >
                        <FiDownload size={13} />
                        <span>Download</span>
                      </a>
                    </div>

                    {/* Image Preview if file is an image */}
                    {item.mimeType && item.mimeType.startsWith('image/') && (
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <img
                          src={item.fileUrl}
                          alt={item.fileName}
                          className="max-h-60 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
