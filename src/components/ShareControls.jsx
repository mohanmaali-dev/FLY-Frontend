import { useRef, useState } from 'react'
import {
  FiFile,
  FiFileText,
  FiLink,
  FiPaperclip,
  FiSend,
} from 'react-icons/fi'

import { uploadPairingFile } from '../services/pairing.service.js'

export function ShareControls({ onSendText, onSendLink, onSendFile, disabled = false }) {
  const [activeTab, setActiveTab] = useState('text') // 'text' | 'link' | 'file'

  // Text state
  const [textContent, setTextContent] = useState('')

  // Link state
  const [linkUrl, setLinkUrl] = useState('')
  const [linkNote, setLinkNote] = useState('')

  // File state
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

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Share Content</h2>
          <p className="text-xs text-slate-500">Send text snippets, links, or files across devices</p>
        </div>

        {/* Tab Selector */}
        <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200/60">
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'text'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FiFileText size={14} />
            <span>Text</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'link'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FiLink size={14} />
            <span>Link</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'file'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FiFile size={14} />
            <span>File</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {/* 1. TEXT */}
        {activeTab === 'text' && (
          <form onSubmit={submitText} className="space-y-3">
            <textarea
              rows={3}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste text, notes, or code snippet..."
              disabled={disabled}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition focus:border-slate-400 focus:bg-white disabled:opacity-50"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {textContent.length} characters
              </span>
              <button
                type="submit"
                disabled={!textContent.trim() || disabled}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiSend size={13} /> Send Text
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition focus:border-slate-400 focus:bg-white disabled:opacity-50"
              />
              <input
                type="text"
                value={linkNote}
                onChange={(e) => setLinkNote(e.target.value)}
                placeholder="Title / Note (optional)"
                disabled={disabled}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition focus:border-slate-400 focus:bg-white disabled:opacity-50"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!linkUrl.trim() || disabled}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiSend size={13} /> Send Link
              </button>
            </div>
          </form>
        )}

        {/* 3. FILE */}
        {activeTab === 'file' && (
          <form onSubmit={submitFile} className="space-y-3">
            <div
              onClick={() => !disabled && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition cursor-pointer ${
                disabled
                  ? 'border-slate-200 bg-slate-50/50 opacity-50 cursor-not-allowed'
                  : 'border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-100/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled}
              />
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-xs border border-slate-200">
                <FiPaperclip size={16} />
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-900">
                {selectedFile ? selectedFile.name : 'Click to select a file'}
              </p>
              <p className="text-[11px] text-slate-500">
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                  : 'Documents, images, video, audio up to 50MB'}
              </p>
            </div>

            {uploadError && (
              <p className="text-xs text-red-500">{uploadError}</p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!selectedFile || isUploading || disabled}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiSend size={13} />
                {isUploading ? 'Uploading...' : 'Send File'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
