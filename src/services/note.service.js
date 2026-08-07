import { request } from './api.js'

export const getNotes = () => request('get', '/notes')

export const createNote = (data) => request('post', '/notes', data)

export const updateNote = (noteId, data) => request('patch', `/notes/${noteId}`, data)

export const deleteNote = (noteId) => request('delete', `/notes/${noteId}`)
