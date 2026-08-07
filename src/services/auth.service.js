import { request } from './api.js'

export const register = (data) => request('post', '/auth/register', data)

export const login = (data) => request('post', '/auth/login', data)

export const logout = () => request('post', '/auth/logout')

export const getCurrentUser = () => request('get', '/auth/me')

export const refreshSession = () => request('post', '/auth/refresh')

export const forgotPassword = (email) =>
  request('post', '/auth/forgot-password', { email })

export const resetPassword = (token, password) =>
  request('post', '/auth/reset-password', { token, password })

export const verifyEmail = (token) => request('post', '/auth/verify-email', { token })

export const sendVerificationEmail = () => request('post', '/auth/send-verification')
