const bcrypt = require('bcryptjs')
const User = require('../models/User')
const { signAccessToken } = require('../utils/tokenUtils')
const logger = require('../utils/logger')

const sanitizeAuthPayload = ({ username, email, password } = {}) => ({
  username: typeof username === 'string' ? username.trim() : '',
  email: typeof email === 'string' ? email.trim().toLowerCase() : '',
  password: typeof password === 'string' ? password : '',
})

const buildAuthResponse = (user) => ({
  token: signAccessToken(user),
  user: {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
  },
})

const register = async (req, res) => {
  try {
    const { username, email, password } = sanitizeAuthPayload(req.body)

    if (username.length < 3) {
      logger.warn({ email }, 'Rejected register request: username too short')
      return res.status(400).json({ message: 'Username must be at least 3 characters' })
    }

    if (!email || !email.includes('@')) {
      logger.warn({ email }, 'Rejected register request: invalid email')
      return res.status(400).json({ message: 'A valid email is required' })
    }

    if (password.length < 6) {
      logger.warn({ email }, 'Rejected register request: password too short')
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    const existingUser = await User.findOne({ email }).select('_id')

    if (existingUser) {
      logger.warn({ email }, 'Rejected register request: email already exists')
      return res.status(409).json({ message: 'An account with that email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ username, email, passwordHash })
    logger.info({ userId: user._id.toString(), email }, 'User registered')

    return res.status(201).json(buildAuthResponse(user))
  } catch (error) {
    logger.error({ err: error }, 'Unable to register user')
    return res.status(500).json({ message: 'Unable to register user' })
  }
}

const login = async (req, res) => {
  try {
    const { email, password } = sanitizeAuthPayload(req.body)

    if (!email || !password) {
      logger.warn({ email }, 'Rejected login request: missing credentials')
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const user = await User.findOne({ email }).select('+passwordHash username email')

    if (!user) {
      logger.warn({ email }, 'Rejected login request: user not found')
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

    if (!isPasswordValid) {
      logger.warn({ email }, 'Rejected login request: invalid password')
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    logger.info({ userId: user._id.toString(), email }, 'User logged in')

    return res.status(200).json(buildAuthResponse(user))
  } catch (error) {
    logger.error({ err: error }, 'Unable to log in')
    return res.status(500).json({ message: 'Unable to log in' })
  }
}

const me = async (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user._id.toString(),
      username: req.user.username,
      email: req.user.email,
    },
  })
}

module.exports = {
  register,
  login,
  me,
}