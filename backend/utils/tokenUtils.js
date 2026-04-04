const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required')
}

const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      username: user.username,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  )

const verifyAccessToken = (token) => jwt.verify(token, JWT_SECRET)

const extractBearerToken = (authorizationHeader = '') => {
  if (!authorizationHeader.startsWith('Bearer ')) {
    return null
  }

  return authorizationHeader.slice(7).trim()
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  extractBearerToken,
}