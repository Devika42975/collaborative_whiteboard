const User = require('../models/User')
const { extractBearerToken, verifyAccessToken } = require('../utils/tokenUtils')

const requireAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization)

    if (!token) {
      return res.status(401).json({ message: 'Authentication token is required' })
    }

    const payload = verifyAccessToken(token)
    const user = await User.findById(payload.sub).select('_id username email')

    if (!user) {
      return res.status(401).json({ message: 'Authenticated user no longer exists' })
    }

    req.user = user
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired authentication token' })
  }
}

module.exports = {
  requireAuth,
}