import { useRef, useState } from 'react'
import {
  FiFile,
  FiFileText,
  FiLink,
  FiSend,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi'

import {
  deletePairingFile,
  uploadPairingFile,
} from '../services/storage.service.js'
import { randomUUID } from '../utils/browser.js'
import {
  MAX_LINK_NOTE_LENGTH,
  MAX_TEXT_LENGTH,
  normalizeShareUrl,
  validateShareFile,
} from '../utils/transfer.js'
import { toUserMessage } from '../utils/errors.js'
import { recordEvent } from '../services/telemetry.service.js'
import { useToast } from './Toast.jsx'

const MAX_QUEUE_FILES = 10

const TABS = [
  { id: 'text', label: 'Text', icon: FiFileText },
  { id: 'link', label: 'Link', icon: FiLink },
  { id: 'file', label: 'Files', icon: FiFile },
]

const FIELD =
  'w-full rounded-xl border border-line-strong bg-sunken px-4 py-3 text-base text-ink placeholder-ink-mute shadow-[inset_0_2px_4px_rgba(18,20,29,0.06)] transition hover:border-ink-mute focus:bg-surface disabled:cursor-not-allowed disabled:border-line disabled:bg-raised disabled:text-ink-mute disabled:shadow-none sm:text-sm'

const SUBMIT =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-button)] transition active:scale-[0.97] hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-mute disabled:shadow-none disabled:active:scale-100 sm:w-auto sm:py-2.5'

const formatFileSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function ShareControls({
  sessionId,
  onSendText,
  onSendLink,
  onSendFile,
  onRemoveItem,
  disabled = false,
  disabledReason = '',
}) {
  const [activeTab, setActiveTab] = useState('text')
  const [textContent, setTextContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkNote, setLinkNote] = useState('')
  const [fileQueue, setFileQueue] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [sendError, setSendError] = useState('')

  const fileInputRef = useRef(null)
  const uploadControllerRef = useRef(null)
  const { toast } = useToast()

  const updateQueuedFile = (id, patch) => {
    setFileQueue((queue) =>
      queue.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    )
  }

  const addFiles = (incoming) => {
    if (disabled || isUploading) return

    const candidates = Array.from(incoming || [])
    if (!candidates.length) return

    const additions = []
    const fingerprints = new Set(
      fileQueue.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`),
    )

    for (const file of candidates) {
      if (fileQueue.length + additions.length >= MAX_QUEUE_FILES) continue
      const validationError = validateShareFile(file)
      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`
      if (validationError || fingerprints.has(fingerprint)) continue

      fingerprints.add(fingerprint)
      additions.push({
          id: randomUUID(),
          file,
          status: 'ready',
          progress: 0,
          error: '',
          uploaded: null,
      })
    }

    const accepted = additions.length
    const rejected = candidates.length - accepted
    setFileQueue((current) => [...current, ...additions].slice(0, MAX_QUEUE_FILES))

    setActiveTab('file')
    setSendError('')
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (accepted) {
        toast({
          tone: 'success',
          title: `${accepted} ${accepted === 1 ? 'file' : 'files'} added`,
          description: 'Review the queue, then send when ready.',
        })
    }
    if (rejected) {
        toast({
          tone: 'warning',
          title: `${rejected} ${rejected === 1 ? 'file was' : 'files were'} skipped`,
          description: `Files must be unique, non-empty, under 50 MB, and the queue holds ${MAX_QUEUE_FILES}.`,
        })
    }
  }

  const removeQueuedFile = async (entry) => {
    if (isUploading) return
    setFileQueue((queue) => queue.filter((item) => item.id !== entry.id))

    if (entry.uploaded?.storagePath) {
      await deletePairingFile(entry.uploaded.storagePath).catch(() => {})
      await onRemoveItem?.(entry.id).catch(() => {})
    }
  }

  const submitText = async (event) => {
    event.preventDefault()
    if (!textContent.trim() || disabled || isSending) return

    try {
      setIsSending(true)
      setSendError('')
      await onSendText(textContent.trim())
      setTextContent('')
      toast({ tone: 'success', title: 'Text sent' })
    } catch (error) {
      recordEvent('transfer_failed', { type: 'text', errorName: error?.name || 'Error' })
      const message = toUserMessage(error, 'Could not send text')
      setSendError(message)
      toast({ tone: 'error', title: 'Text was not sent', description: message })
    } finally {
      setIsSending(false)
    }
  }

  const submitLink = async (event) => {
    event.preventDefault()
    if (!linkUrl.trim() || disabled || isSending) return

    try {
      const finalUrl = normalizeShareUrl(linkUrl)
      setIsSending(true)
      setSendError('')
      await onSendLink(finalUrl, linkNote.trim())
      setLinkUrl('')
      setLinkNote('')
      toast({ tone: 'success', title: 'Link sent' })
    } catch (error) {
      recordEvent('transfer_failed', { type: 'link', errorName: error?.name || 'Error' })
      const message = toUserMessage(error, 'Could not send link')
      setSendError(message)
      toast({ tone: 'error', title: 'Link was not sent', description: message })
    } finally {
      setIsSending(false)
    }
  }

  const submitFiles = async (event) => {
    event.preventDefault()
    if (!fileQueue.length || disabled || isUploading) return
    if (!sessionId) {
      setSendError('No active pairing session to upload into.')
      return
    }

    setIsUploading(true)
    setSendError('')
    let sentCount = 0
    let failedCount = 0

    for (const queued of fileQueue) {
      const controller = new AbortController()
      uploadControllerRef.current = controller
      let uploaded = queued.uploaded

      try {
        updateQueuedFile(queued.id, { status: 'uploading', error: '' })

        if (!uploaded) {
          uploaded = await uploadPairingFile(sessionId, queued.file, {
            signal: controller.signal,
            onProgress: (progress) => updateQueuedFile(queued.id, { progress }),
          })
          updateQueuedFile(queued.id, { uploaded, progress: 100 })
        }

        await onSendFile({ ...uploaded, id: queued.id })
        sentCount += 1
        setFileQueue((queue) => queue.filter((entry) => entry.id !== queued.id))
      } catch (error) {
        failedCount += 1
        recordEvent(uploaded ? 'transfer_failed' : 'upload_failed', {
          type: 'file',
          errorName: error?.name || 'Error',
        })
        const message = toUserMessage(error, 'File upload failed')
        updateQueuedFile(queued.id, {
          uploaded,
          status: controller.signal.aborted ? 'ready' : 'failed',
          error: controller.signal.aborted ? 'Upload cancelled' : message,
        })

        if (controller.signal.aborted) break
      }
    }

    uploadControllerRef.current = null
    setIsUploading(false)

    if (sentCount) {
      toast({
        tone: 'success',
        title: `${sentCount} ${sentCount === 1 ? 'file' : 'files'} sent`,
      })
    }
    if (failedCount) {
      const message = `${failedCount} ${failedCount === 1 ? 'file needs' : 'files need'} attention. Retry when the connection is ready.`
      setSendError(message)
      toast({ tone: 'warning', title: 'Queue not fully sent', description: message })
    }
  }

  const handlePaste = (event) => {
    const files = Array.from(event.clipboardData?.files || [])
    if (!files.length) return
    event.preventDefault()
    addFiles(files)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    addFiles(event.dataTransfer.files)
  }

  return (
    <div className="w-full" onPaste={handlePaste}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink">Send something</h2>
          <p className="mt-0.5 text-xs text-ink-mute">Choose what you want to share.</p>
        </div>

        <div
          role="tablist"
          aria-label="Share type"
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const currentIndex = TABS.findIndex((tab) => tab.id === activeTab)
            const nextIndex = event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? TABS.length - 1
                : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
            setActiveTab(TABS[nextIndex].id)
            event.currentTarget.querySelector(`#share-tab-${TABS[nextIndex].id}`)?.focus()
          }}
          className="grid grid-cols-3 rounded-xl border border-line bg-raised p-1 sm:inline-flex"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`share-panel-${tab.id}`}
                id={`share-tab-${tab.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition sm:py-1.5 ${active ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-ink-soft hover:text-ink'}`}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{tab.label}</span>
                {tab.id === 'file' && fileQueue.length > 0 && (
                  <span className="rounded-full bg-accent-soft px-1.5 text-[0.65rem] tabular-nums text-accent">{fileQueue.length}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {disabled && disabledReason && (
        <p className="mt-4 rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">{disabledReason}</p>
      )}

      <div className="mt-5 sm:min-h-[300px]">
        {activeTab === 'text' && (
          <form id="share-panel-text" role="tabpanel" aria-labelledby="share-tab-text" onSubmit={submitText} className="flex h-full flex-col gap-3 sm:min-h-[300px]">
            <textarea rows={3} value={textContent} onChange={(event) => setTextContent(event.target.value)} placeholder="Paste text, notes, or a code snippet..." disabled={disabled} maxLength={MAX_TEXT_LENGTH} aria-label="Text to share" className={`${FIELD} min-h-[150px] flex-1 resize-y sm:min-h-[230px]`} />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm tabular-nums text-ink-mute">{textContent.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}</span>
              <button type="submit" disabled={!textContent.trim() || disabled || isSending} className={SUBMIT}>
                {isSending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <FiSend size={13} />}
                {isSending ? 'Sending...' : 'Send text'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'link' && (
          <form id="share-panel-link" role="tabpanel" aria-labelledby="share-tab-link" onSubmit={submitLink} className="flex h-full flex-col gap-3 sm:min-h-[300px]">
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="text" inputMode="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" disabled={disabled} aria-label="Link URL" required className={FIELD} />
              <input type="text" value={linkNote} maxLength={MAX_LINK_NOTE_LENGTH} onChange={(event) => setLinkNote(event.target.value)} placeholder="Title or note (optional)" disabled={disabled} aria-label="Optional link title or note" className={FIELD} />
            </div>
            <p className="text-xs text-ink-mute">Only http and https web links can be shared.</p>
            <div className="mt-auto flex justify-stretch pt-3 sm:justify-end">
              <button type="submit" disabled={!linkUrl.trim() || disabled || isSending} className={SUBMIT}>
                {isSending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <FiSend size={13} />}
                {isSending ? 'Sending...' : 'Send link'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'file' && (
          <form id="share-panel-file" role="tabpanel" aria-labelledby="share-tab-file" onSubmit={submitFiles} className="flex h-full flex-col gap-3 sm:min-h-[300px]">
            <input ref={fileInputRef} type="file" multiple className="sr-only" onChange={(event) => addFiles(event.target.files)} disabled={disabled || isUploading} />
            <div
              onDragEnter={(event) => { event.preventDefault(); if (!disabled) setIsDragging(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false) }}
              onDrop={handleDrop}
              className={`relative flex flex-1 flex-col rounded-xl border border-dashed p-4 transition sm:min-h-[220px] ${disabled ? 'border-line opacity-50' : isDragging ? 'border-accent bg-accent-soft' : 'border-line-strong'}`}
            >
              <button type="button" onClick={() => !disabled && !isUploading && fileInputRef.current?.click()} disabled={disabled || isUploading} className="flex w-full flex-col items-center py-2 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-line bg-accent-soft text-accent"><FiUploadCloud size={18} /></span>
                <span className="mt-2 text-sm font-semibold text-ink">Drop files here or choose files</span>
                <span className="mt-1 text-xs text-ink-mute">Paste works too · up to {MAX_QUEUE_FILES} files · 50 MB each</span>
              </button>

              {fileQueue.length > 0 && (
                <ul className="mt-3 max-h-44 space-y-2 overflow-y-auto" aria-label="Files ready to send">
                  {fileQueue.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-line bg-surface px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <FiFile className="shrink-0 text-accent" size={15} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-ink">{entry.file.name}</p>
                          <p className={`mt-0.5 text-[0.68rem] ${entry.status === 'failed' ? 'text-danger' : 'text-ink-mute'}`}>
                            {entry.status === 'uploading' ? `Uploading ${entry.progress}%` : entry.error || formatFileSize(entry.file.size)}
                          </p>
                        </div>
                        <button type="button" onClick={() => removeQueuedFile(entry)} disabled={isUploading} className="rounded-md p-1.5 text-ink-mute transition hover:bg-danger-soft hover:text-danger disabled:opacity-40" aria-label={`Remove ${entry.file.name} from queue`}><FiX size={13} /></button>
                      </div>
                      {entry.status === 'uploading' && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${entry.progress}%` }} /></div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {isUploading && (
                <button type="button" onClick={() => uploadControllerRef.current?.abort()} className="mx-auto mt-3 text-xs font-semibold text-danger hover:underline">Cancel current upload</button>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs tabular-nums text-ink-mute">{fileQueue.length} / {MAX_QUEUE_FILES} queued</span>
              <button type="submit" disabled={!fileQueue.length || isUploading || disabled} className={SUBMIT}>
                {isUploading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <FiSend size={13} />}
                {isUploading ? 'Sending queue...' : fileQueue.some((entry) => entry.status === 'failed') ? 'Retry failed files' : `Send ${fileQueue.length || ''} ${fileQueue.length === 1 ? 'file' : 'files'}`}
              </button>
            </div>
          </form>
        )}

        {sendError && <p role="alert" className="mt-4 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{sendError}</p>}
      </div>
    </div>
  )
}
