import { useEffect, useState } from 'react'
import Canvas from './components/Canvas'
import {
  clearStoredAuth,
  fetchCurrentUser,
  getStoredAuth,
  loginUser,
  registerUser,
  storeAuth,
} from './lib/auth'
import { disconnectWhiteboardSocket, setWhiteboardSocketToken } from './lib/socket'
import './App.css'

function App() {
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
  })
  const [authState, setAuthState] = useState(() => getStoredAuth())
  const [authMessage, setAuthMessage] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [roomInput, setRoomInput] = useState('demo-room')
  const [activeRoomId, setActiveRoomId] = useState('demo-room')

  useEffect(() => {
    const hydrateAuth = async () => {
      if (!authState?.token) {
        setWhiteboardSocketToken(null)
        return
      }

      try {
        const response = await fetchCurrentUser(authState.token)
        const nextAuthState = {
          token: authState.token,
          user: response.user,
        }

        setAuthState(nextAuthState)
        storeAuth(nextAuthState)
        setWhiteboardSocketToken(nextAuthState.token)
        setAuthMessage(`Authenticated as ${response.user.username}`)
      } catch {
        clearStoredAuth()
        setWhiteboardSocketToken(null)
        setAuthState(null)
      }
    }

    hydrateAuth()
  }, [])

  const handleAuthFieldChange = (field) => (event) => {
    setAuthForm((currentForm) => ({
      ...currentForm,
      [field]: event.target.value,
    }))
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setIsAuthLoading(true)
    setAuthMessage('')

    try {
      const payload =
        authMode === 'register'
          ? await registerUser(authForm)
          : await loginUser({
              email: authForm.email,
              password: authForm.password,
            })

      const nextAuthState = {
        token: payload.token,
        user: payload.user,
      }

      setAuthState(nextAuthState)
      storeAuth(nextAuthState)
      setWhiteboardSocketToken(nextAuthState.token)
      setAuthMessage(`${authMode === 'register' ? 'Registered' : 'Logged in'} as ${payload.user.username}`)
      setAuthForm({
        username: payload.user.username,
        email: payload.user.email,
        password: '',
      })
    } catch (error) {
      setAuthMessage(error.message)
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = () => {
    disconnectWhiteboardSocket()
    clearStoredAuth()
    setWhiteboardSocketToken(null)
    setAuthState(null)
    setAuthMessage('Logged out')
    setAuthForm({
      username: '',
      email: '',
      password: '',
    })
  }

  const handleJoinRoom = (event) => {
    event.preventDefault()

    const nextRoomId = roomInput.trim()

    if (!nextRoomId || !authState?.token) {
      return
    }

    setActiveRoomId(nextRoomId)
  }

  return (
    <div className="canvas-page">
      <div className="canvas-hero">
        <p className="eyebrow">Real-time collaborative whiteboard</p>
        <h1>Draw in the same room from multiple tabs.</h1>
        <p className="canvas-subtitle">
          Authenticate first, then join a named room and watch completed strokes sync to every authenticated participant.
        </p>
      </div>

      <div className="auth-panel">
        <div className="auth-panel-header">
          <div>
            <p className="auth-title">Account</p>
            <p className="auth-copy">JWT tokens are now required for room joins and socket events.</p>
          </div>
          {authState?.user ? (
            <button type="button" className="secondary-btn" onClick={handleLogout}>
              Log Out
            </button>
          ) : null}
        </div>

        <div className="auth-mode-toggle" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={authMode === 'login' ? 'toggle-btn active' : 'toggle-btn'}
            onClick={() => setAuthMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={authMode === 'register' ? 'toggle-btn active' : 'toggle-btn'}
            onClick={() => setAuthMode('register')}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleAuthSubmit}>
          {authMode === 'register' ? (
            <label className="room-field">
              <span>Username</span>
              <input
                type="text"
                value={authForm.username}
                onChange={handleAuthFieldChange('username')}
                placeholder="Choose a username"
                maxLength={30}
              />
            </label>
          ) : null}

          <label className="room-field">
            <span>Email</span>
            <input
              type="email"
              value={authForm.email}
              onChange={handleAuthFieldChange('email')}
              placeholder="you@example.com"
            />
          </label>

          <label className="room-field">
            <span>Password</span>
            <input
              type="password"
              value={authForm.password}
              onChange={handleAuthFieldChange('password')}
              placeholder="At least 6 characters"
            />
          </label>

          <button type="submit" className="join-room-btn" disabled={isAuthLoading}>
            {isAuthLoading ? 'Submitting...' : authMode === 'register' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="auth-message">{authMessage || (authState?.user ? `Ready as ${authState.user.username}` : 'Not authenticated')}</p>
      </div>

      <form className="join-room-form" onSubmit={handleJoinRoom}>
        <label className="room-field">
          <span>Room ID</span>
          <input
            type="text"
            value={roomInput}
            onChange={(event) => setRoomInput(event.target.value)}
            placeholder="example: design-review"
            maxLength={40}
          />
        </label>

        <button type="submit" className="join-room-btn" disabled={!authState?.token}>
          Join Room
        </button>
      </form>

      <Canvas roomId={activeRoomId} token={authState?.token || null} user={authState?.user || null} />
    </div>
  )
}

export default App
