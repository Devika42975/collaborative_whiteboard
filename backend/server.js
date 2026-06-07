const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const connectDB = require('./config/db')

if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

const authRoutes = require('./routes/authRoutes')

const app = express()
const PORT = process.env.PORT || 5000
const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173'
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
const ALLOWED_ORIGINS = [
  ...(process.env.CLIENT_ORIGIN || DEFAULT_CLIENT_ORIGIN)
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
  ...DEV_ORIGINS,
].filter((origin, index, list) => list.indexOf(origin) === index)

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true
  }

  const normalizedOrigin = origin.replace(/\/$/, '')
  return ALLOWED_ORIGINS.includes(normalizedOrigin)
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true)
    }

    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}

app.use(cors(corsOptions))
app.options(/.*/, cors(corsOptions))
app.use(express.json())
app.use('/api/auth', authRoutes)

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.get('/', (req, res) => {
  res.send('Collaborative whiteboard backend is running')
})

const http = require('http')
const { createWhiteboardSocketServer } = require('./socket/whiteboardSocket')

const startServer = async () => {
  try {
    await connectDB()

    // create HTTP server using the express app
    const server = http.createServer(app)

    // attach socket.io server so /socket.io is served from the same port
    createWhiteboardSocketServer(server, {
      cors: {
        origin: (origin, callback) => {
          if (isOriginAllowed(origin)) return callback(null, true)
          return callback(new Error('Not allowed by CORS'))
        },
        credentials: true,
      },
    })

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`)
    })
  } catch (error) {
    console.error(`Unable to start server: ${error.message}`)
    process.exit(1)
  }
}

startServer()