const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
const AUTH_STORAGE_KEY = 'whiteboard-auth'

export const getStoredAuth = () => {
  const rawAuth = window.localStorage.getItem(AUTH_STORAGE_KEY)

  if (!rawAuth) {
    return null
  }

  try {
    return JSON.parse(rawAuth)
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export const storeAuth = (authState) => {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState))
}

export const clearStoredAuth = () => {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

const request = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Request failed')
  }

  return data
}

export const registerUser = (payload) =>
  request('/auth/register', {
    method: 'POST',
    body: payload,
  })

export const loginUser = (payload) =>
  request('/auth/login', {
    method: 'POST',
    body: payload,
  })

export const fetchCurrentUser = (token) =>
  request('/auth/me', {
    token,
  })