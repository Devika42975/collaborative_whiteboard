const http = require('http')
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const pinoHttp = require('pino-http')

if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}
const connectDB = require('./config/db')
const { createWhiteboardSocketServer } = require('./socket/whiteboardSocket')
const authRoutes = require('./routes/authRoutes')
const logger = require('./utils/logger')
const {
  flushStrokeBufferNow,
  startStrokeFlushWorker,
  stopStrokeFlushWorker,
} = require('./workers/strokeFlushWorker')

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 5000
const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173'
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || DEFAULT_CLIENT_ORIGIN)
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)
let isShuttingDown = false

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true
  }

  const normalizedOrigin = origin.replace(/\/$/, '')
  return ALLOWED_ORIGINS.includes(normalizedOrigin)
}

server.on('error', (error) => {
  logger.error({ err: error, port: PORT }, 'Server listen error')
  process.exit(1)
})

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true)
      }

      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  })
)
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] || undefined,
  })
)
app.use(express.json())
app.use('/api/auth', authRoutes)

createWhiteboardSocketServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true)
      }

      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  },
})
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})
app.get('/', (req, res) => {
  res.send('Collaborative whiteboard backend is running')
})
const startServer = async () => {
  try {
    await connectDB()
    startStrokeFlushWorker()
    server.listen(PORT, () => {
      logger.info({ port: PORT }, 'HTTP and Socket server listening')
    })
  } catch (error) {
    logger.error({ err: error }, 'Unable to start server')
    process.exit(1)
  }
}

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  logger.info({ signal }, 'Graceful shutdown started')

  try {
    stopStrokeFlushWorker()
    await flushStrokeBufferNow('shutdown')
    await new Promise((resolve) => {
      server.close(() => resolve())
    })
    logger.info('Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    logger.error({ err: error }, 'Graceful shutdown failed')
    process.exit(1)
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((error) => logger.error({ err: error }, 'SIGINT shutdown failed'))
})

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((error) => logger.error({ err: error }, 'SIGTERM shutdown failed'))
})

startServer()
