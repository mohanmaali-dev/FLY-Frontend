import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext.jsx'
import * as noteService from '../services/note.service.js'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'

function NotesPage() {
  const { logout } = useAuth()
  const [notes, setNotes] = useState([])
  const [form, setForm] = useState({ title: '', content: '', image: null })
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadNotes = async () => {
    try {
      const result = await noteService.getNotes()
      setNotes(result.data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotes()
  }, [])

  const resetForm = () => {
    setForm({ title: '', content: '', image: null })
    setEditingId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const data = new FormData()
    data.append('title', form.title)
    data.append('content', form.content)
    if (form.image) data.append('image', form.image)

    try {
      if (editingId) {
        await noteService.updateNote(editingId, data)
      } else {
        await noteService.createNote(data)
      }

      resetForm()
      await loadNotes()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const startEditing = (note) => {
    setEditingId(note._id)
    setForm({ title: note.title, content: note.content, image: null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (noteId) => {
    if (!window.confirm('Delete this note?')) return

    try {
      await noteService.deleteNote(noteId)
      setNotes((currentNotes) => currentNotes.filter((note) => note._id !== noteId))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-primary/15 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-bold text-primary-dark">
              TEST
            </Link>
            <Link to="/dashboard" className="text-sm font-semibold text-slate-500 hover:text-primary-dark">
              Dashboard
            </Link>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-light"
          >
            Logout
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold">My notes</h1>
        <p className="mt-2 text-slate-500">Create notes.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl border border-primary/15 bg-white p-6">
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Note title"
            className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-primary"
            required
          />
          <textarea
            value={form.content}
            onChange={(event) => setForm({ ...form, content: event.target.value })}
            placeholder="Write your note..."
            rows="4"
            className="w-full resize-none rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-primary"
          />
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setForm({ ...form, image: event.target.files[0] || null })}
            className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-light file:px-4 file:py-2 file:font-semibold file:text-primary-dark"
          />

          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <div className="flex gap-3">
            <button disabled={submitting} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
              {submitting ? 'Saving...' : editingId ? 'Update note' : 'Create note'}
            </button>
            {editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-slate-200 px-5 py-2.5 font-semibold text-slate-600">Cancel</button>}
          </div>
        </form>

        <section className="mt-8">
          {loading ? (
            <p className="text-slate-500">Loading notes...</p>
          ) : notes.length === 0 ? (
            <p className="text-slate-500">No notes yet.</p>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <article
                  key={note._id}
                  className="flex w-full flex-col gap-5 border border-slate-200 bg-white p-5 sm:flex-row"
                >
                  {note.image && (
                    <img
                      src={`${SERVER_URL}${note.image}`}
                      alt={note.title}
                      className="h-44 w-full object-cover sm:h-32 sm:w-48"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-xl font-bold">{note.title}</h2>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-4 text-sm font-semibold">
                        <button
                          onClick={() => startEditing(note)}
                          className="text-primary-dark hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(note._id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {note.content && (
                      <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-600">
                        {note.content}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default NotesPage
