import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext.jsx'
import * as noteService from '../services/note.service.js'
import { AppHeader } from '../components/AppHeader.jsx'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'

function NotesPage() {
  const { user, logout } = useAuth()
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
    <div className="min-h-screen bg-ink-50 text-ink-800">
      <AppHeader user={user} onLogout={logout} />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink-900">My notes</h1>
          <p className="mt-1 text-sm text-ink-500">Create and manage your notes.</p>
        </div>

        <form onSubmit={handleSubmit} className="surface p-5 sm:p-6">
          <div className="flex flex-col gap-4">
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="Note title"
              className="w-full rounded-md border border-border bg-white px-4 py-2.5 text-[14px] text-ink-800 outline-none placeholder:text-ink-400 focus:border-primary focus:ring-2 focus:ring-primary-ring"
              required
            />
            <textarea
              value={form.content}
              onChange={(event) =>
                setForm({ ...form, content: event.target.value })
              }
              placeholder="Write your note..."
              rows="4"
              className="w-full resize-y rounded-md border border-border bg-white px-4 py-2.5 text-[14px] text-ink-800 outline-none placeholder:text-ink-400 focus:border-primary focus:ring-2 focus:ring-primary-ring min-h-[110px]"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                setForm({
                  ...form,
                  image: event.target.files[0] || null,
                })
              }
              className="block w-full cursor-pointer text-sm text-ink-600 file:mr-4 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-dark"
            />
          </div>

          {error && (
            <p className="mt-4 rounded-md bg-primary-50 px-4 py-2.5 text-sm text-primary-dark">
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <button
              disabled={submitting}
              className="rounded-md bg-primary px-5 py-2.5 font-semibold text-white transition hover:bg-primary-600 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : editingId ? 'Update note' : 'Create note'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-border bg-white px-5 py-2.5 font-semibold text-ink-600 transition hover:bg-ink-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <section className="mt-8">
          {loading ? (
            <p className="text-ink-500">Loading notes...</p>
          ) : notes.length === 0 ? (
            <div className="surface p-6 text-center sm:p-10">
              <p className="text-ink-500">No notes yet. Create one above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <article
                  key={note._id}
                  className="flex w-full flex-col gap-5 rounded-xl border border-border bg-white p-5 sm:flex-row"
                >
                  {note.image && (
                    <img
                      src={`${SERVER_URL}${note.image}`}
                      alt={note.title}
                      className="h-44 w-full rounded-md object-cover sm:h-32 sm:w-48"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-ink-900">
                          {note.title}
                        </h2>
                        <p className="mt-1 text-xs text-ink-400">
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
                          className="text-primary-dark hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {note.content && (
                      <p className="mt-4 whitespace-pre-wrap leading-7 text-ink-600">
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
