import { useRef, useState } from 'react'
import {
  FiFile,
  FiFileText,
  FiLink,
  FiPaperclip,
  FiSend,
} from 'react-icons/fi'

import { uploadPairingFile } from '../services/storage.service.js'
import { toUserMessage } from '../utils/errors.js'

const TABS = [
  { id: 'text', label: 'Text', icon: FiFileText },
  { id: 'link', label: 'Link', icon: FiLink },
  { id: 'file', label: 'File', icon: FiFile },
]

// A white field inside a white card, outlined only by a hairline, reads as
// disabled even when it is not. `sunken` (#f1f3f9) is a fill you can actually
// see against white — `raised` is only 1.02:1 and would have changed nothing.
// Focus lifts it to white, so typing feels like the field opening up.
const FIELD =
  'w-full rounded-xl border border-line-strong bg-sunken px-4 py-3 text-base text-ink placeholder-ink-mute shadow-[inset_0_2px_4px_rgba(18,20,29,0.06)] transition hover:border-ink-mute focus:bg-surface disabled:cursor-not-allowed disabled:border-line disabled:bg-raised disabled:text-ink-mute disabled:shadow-none sm:text-sm'

// Dimming a dark button with opacity turns it muddy grey, which looks broken.
// A flat recessed fill reads as "not yet" instead.
const SUBMIT =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-button)] transition active:scale-[0.97] hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-mute disabled:shadow-none disabled:active:scale-100 sm:w-auto sm:py-2.5'

export function ShareControls({
  sessionId,
  onSendText,
  onSendLink,
  onSendFile,
  disabled = false,
  disabledReason = '',
}) {
  const [activeTab, setActiveTab] = useState('text') // 'text' | 'link' | 'file'

  // Text state
  const [textContent, setTextContent] = useState('')

  // Link state
  const [linkUrl, setLinkUrl] = useState('')
  const [linkNote, setLinkNote] = useState('')

  // File state
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Shared by all three tabs — sending fails the same way (socket not open)
  // whatever the payload is, and that used to surface only as a console error.
  const [sendError, setSendError] = useState('')

  const fileInputRef = useRef(null)

  // Sending is async now (Realtime broadcast is awaited), so these must await
  // rather than rely on a synchronous throw.
  const submitText = async (e) => {
    e.preventDefault()
    if (!textContent.trim() || disabled) return

    try {
      setSendError('')
      await onSendText(textContent.trim())
      setTextContent('')
    } catch (err) {
      setSendError(toUserMessage(err, 'Could not send text'))
    }
  }

  const submitLink = async (e) => {
    e.preventDefault()
    if (!linkUrl.trim() || disabled) return

    let finalUrl = linkUrl.trim()
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`
    }

    try {
      setSendError('')
      await onSendLink(finalUrl, linkNote.trim())
      setLinkUrl('')
      setLinkNote('')
    } catch (err) {
      setSendError(toUserMessage(err, 'Could not send link'))
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setSendError('')
    }
  }

  const submitFile = async (e) => {
    e.preventDefault()
    if (!selectedFile || disabled || isUploading) return

    if (!sessionId) {
      setSendError('No active pairing session to upload into')
      return
    }

    try {
      setIsUploading(true)
      setSendError('')

      // Supabase Storage returns a fully qualified public URL, so there is no
      // server origin to prepend any more.
      const fileData = await uploadPairingFile(sessionId, selectedFile)

      await onSendFile(fileData)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setSendError(toUserMessage(err, 'File upload failed'))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-lg font-semibold tracking-tight">Share</h2>

        {/* One loop rather than three near-identical hand-written buttons. */}
        {/* Full-width thirds on a phone: an inline row gave ~64px tap targets
            crammed against the edge of the card. */}
        <div
          role="tablist"
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
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition sm:py-1.5 ${
                  active
                    ? 'bg-surface text-ink shadow-[var(--shadow-card)]'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* A disabled form with no explanation just reads as broken. */}
      {disabled && disabledReason && (
        <p className="mt-4 rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">
          {disabledReason}
        </p>
      )}

      {/* Tab Panels */}
      <div className="mt-5">
        {/* 1. TEXT */}
        {activeTab === 'text' && (
          <form onSubmit={submitText} className="space-y-3">
            <textarea
              rows={3}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste text, notes, or a code snippet..."
              disabled={disabled}
              className={FIELD}
            />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-ink-mute">
                {textContent.length} characters
              </span>
              <button type="submit" disabled={!textContent.trim() || disabled} className={SUBMIT}>
                <FiSend size={13} /> Send text
              </button>
            </div>
          </form>
        )}

        {/* 2. LINK */}
        {activeTab === 'link' && (
          <form onSubmit={submitLink} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={disabled}
                required
                className={FIELD}
              />
              <input
                type="text"
                value={linkNote}
                onChange={(e) => setLinkNote(e.target.value)}
                placeholder="Title or note (optional)"
                disabled={disabled}
                className={FIELD}
              />
            </div>
            <div className="flex justify-stretch sm:justify-end">
              <button type="submit" disabled={!linkUrl.trim() || disabled} className={SUBMIT}>
                <FiSend size={13} /> Send link
              </button>
            </div>
          </form>
        )}

        {/* 3. FILE */}
        {activeTab === 'file' && (
          <form onSubmit={submitFile} className="space-y-3">
            <div
              onClick={() => !disabled && fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center transition ${
                disabled
                  ? 'cursor-not-allowed border-line opacity-50'
                  : 'border-line-strong hover:bg-raised'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled}
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-soft">
                <FiPaperclip size={18} />
              </div>
              <p className="mt-3 max-w-full truncate text-sm font-medium text-ink">
                {selectedFile ? selectedFile.name : 'Choose a file'}
              </p>
              <p className="mt-1 text-sm text-ink-mute">
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                  : 'Up to 50 MB'}
              </p>
            </div>

            <div className="flex justify-stretch sm:justify-end">
              <button
                type="submit"
                disabled={!selectedFile || isUploading || disabled}
                className={SUBMIT}
              >
                {isUploading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <FiSend size={13} />
                )}
                {isUploading ? 'Uploading...' : 'Send file'}
              </button>
            </div>
          </form>
        )}

        {sendError && (
          <p className="mt-4 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
            {sendError}
          </p>
        )}
      </div>
    </div>
  )
}
