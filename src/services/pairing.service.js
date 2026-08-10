import { request } from './api.js'

export const createPairingSession = async () => {
  const response = await request('POST', '/pairing')

  return response.data
}

export const getPairingSession = async (sessionId) => {
  const response = await request(
    'GET',
    `/pairing/${sessionId}`,
  )

  return response.data
}

export const uploadPairingFile = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await request('POST', '/pairing/upload', formData)

  return response.data
}
