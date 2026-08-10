import { useRef, useState } from 'react'
import {
  FiAlertCircle,
  FiFile,
  FiFileText,
  FiLink,
  FiPaperclip,
  FiSend,
  FiUpload,
} from 'react-icons/fi'

import { uploadPairingFile } from '../services/pairing.service.js'

const TABS = [
  { id: 'text', label: 'Text', Icon: FiFileText },
  { id: 'link', label: 'Link', Icon: FiLink },
  { id: 'file', label: 'File', Icon: FiFile },
]

export function ShareControls({
  onSendText,
  onSendLink,
  onSendFile,
  disabled = false,
}) {
  const [activeTab, setActiveTab] = useState('text')

  const [textContent, setTextContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkNote, setLinkNote] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const fileInputRef = useRef(null)

  const submitText = (e) => {
    e.preventDefault()
    if (!textContent.trim() || disabled) return
    onSendText(textContent.trim())
    setTextContent('')
  }

  const submitLink = (e) => {
    e.preventDefault()
    if (!linkUrl.trim() || disabled) return
    let finalUrl = linkUrl.trim()
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`
    }
    onSendLink(finalUrl, linkNote.trim())
    setLinkUrl('')
    setLinkNote('')
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setUploadError('')
    }
  }

  const submitFile = async (e) => {
    e.preventDefault()
    if (!selectedFile || disabled || isUploading) return

    try {
      setIsUploading(true)
      setUploadError('')
      const fileData = await uploadPairingFile(selectedFile)
      const baseUrl = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
        : 'http://localhost:5000'

      onSendFile({
        fileName: fileData.fileName,
        fileUrl: `${baseUrl}${fileData.fileUrl}`,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
      })
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setUploadError(err.message || 'File upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const inputCls =
    'w-full rounded-md border border-border bg-white px-3.5 py-2.5 text-[14px] text-ink-800 placeholder:text-ink-400 outline-hidden transition focus:border-primary focus:ring-2 focus:ring-primary-ring disabled:opacity-50 disabled:cursor-not-allowed'

  const primaryBtn =
    'inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition hover:bg-primary-600 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary sm:w-auto'

  return (
    <section className="surface p-4 sm:p-5">
      <header className="flex flex-col gap-2 border-b border-border-soft pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink-900 sm:text-base">
            Share content
          </h2>
          <p className="mt-1 text-[13px] text-ink-500">
            Send text, links, or files to the paired device.
          </p>
        </div>

        {disabled && (
           <span className="badge self-start bg-ink-50 text-ink-600 border border-border sm:self-end">
            <FiAlertCircle size={12} />
            Waiting for device
          </span>
        )}
      </header>

      {/* Segmented Tabs */}
      <div
        role="tablist"
        aria-label="Content type"
        className="mt-4 inline-flex w-full items-stretch rounded-md border border-border bg-ink-50 p-1"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2.5 py-2 text-[13px] font-medium transition-colors ${active
                  ? 'bg-white text-ink-900 ring-1 ring-inset ring-border shadow-xs'
                  : 'text-ink-500 hover:text-ink-700'
                }`}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Panels */}
      <div className="mt-5">
        {activeTab === 'text' && (
          <form onSubmit={submitText} className="space-y-3">
            <textarea
              rows={4}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste text, notes, or a code snippet…"
              disabled={disabled}
              className={inputCls + ' resize-y min-h-[110px] leading-7'}
            />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span
                className={`text-[11px] font-medium tabular-nums ${textContent.length > 4000 ? 'text-primary-600' : 'text-ink-400'
                  }`}
              >
                {textContent.length.toLocaleString()} characters
              </span>
              <button
                type="submit"
                disabled={!textContent.trim() || disabled}
                className={primaryBtn + ' w-full'}
              >
                <FiSend size={14} />
                <span>Send text</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === 'link' && (
          <form onSubmit={submitLink} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-ink-700">
                  URL
                </label>
                <div className="relative">
                  <FiLink
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
                    aria-hidden="true"
                  />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="example.com/article"
                    disabled={disabled}
                    className={inputCls + ' pl-10'}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-ink-700">
                  Title or note{' '}
                  <span className="font-normal text-ink-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={linkNote}
                  onChange={(e) => setLinkNote(e.target.value)}
                  placeholder="e.g. Product spec"
                  disabled={disabled}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <span className="text-[11px] font-medium text-ink-400 sm:hidden">
                Tip: missing https:// is added automatically.
              </span>
              <button
                type="submit"
                disabled={!linkUrl.trim() || disabled}
                className={primaryBtn + ' w-full'}
              >
                <FiSend size={14} />
                <span>Send link</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === 'file' && (
          <form onSubmit={submitFile} className="space-y-4">
            <div>
              <input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={handleFileChange}
                disabled={disabled || isUploading}
              />

              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center justify-center gap-3 rounded-md border px-5 py-7 text-center transition-colors ${disabled || isUploading
                    ? 'cursor-not-allowed border-dashed border-border bg-ink-50 opacity-60'
                    : 'cursor-pointer border-dashed border-border bg-white hover:bg-ink-50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-ring'
                  }`}
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-md ring-1 ring-inset ring-border ${selectedFile
                      ? 'bg-primary-50 text-primary-dark'
                      : 'bg-white text-ink-500'
                    }`}
                >
                  {selectedFile ? (
                    <FiPaperclip size={20} />
                  ) : (
                    <FiUpload size={20} />
                  )}
                </div>

                <div>
                  <p className="text-[13px] font-medium text-ink-800 sm:text-sm">
                    {selectedFile
                      ? selectedFile.name
                      : 'Click to select a file'}
                  </p>

                  <p className="mt-1 text-[12px] text-ink-500">
                    {selectedFile
                      ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                      : 'Documents, images, video, audio — up to 50 MB'}
                  </p>
                </div>
              </label>
            </div>

            {uploadError && (
              <div                className="flex items-start gap-2 rounded-md border border-primary-100 bg-primary-50 px-3.5 py-3 text-[12px] text-primary-dark">
                <FiAlertCircle size={14} className="mt-0.5 shrink-0" />
                <span className="font-medium">{uploadError}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!selectedFile || isUploading || disabled}
                className={primaryBtn + ' w-full'}
              >
                <FiSend size={14} />
                <span>{isUploading ? 'Uploading…' : 'Send file'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
