const { Server } = require('socket.io')
const Room = require('../models/Room')
const Stroke = require('../models/Stroke')
const User = require('../models/User')
const { verifyAccessToken } = require('../utils/tokenUtils')
const logger = require('../utils/logger')
const { enqueueStroke, getBufferedStrokesForRoom } = require('../workers/strokeFlushWorker')

const MAX_POINTS_PER_STROKE = 5000

const sanitizeStrokePayload = (payload = {}) => {
  const { roomId, strokeId, tool, color, brushSize, points } = payload

  if (typeof roomId !== 'string' || !roomId.trim()) {
    return { error: 'roomId is required' }
  }

  if (typeof strokeId !== 'string' || !strokeId.trim()) {
    return { error: 'strokeId is required' }
  }

  if (!Array.isArray(points) || points.length < 2 || points.length > MAX_POINTS_PER_STROKE) {
    return { error: 'points must contain between 2 and 5000 entries' }
  }

  if (!['pen', 'eraser'].includes(tool)) {
    return { error: 'tool must be pen or eraser' }
  }

  if (typeof color !== 'string' || !color.trim()) {
    return { error: 'color is required' }
  }

  if (typeof brushSize !== 'number' || Number.isNaN(brushSize) || brushSize < 1 || brushSize > 50) {
    return { error: 'brushSize must be between 1 and 50' }
  }

  const normalizedPoints = []

  for (const point of points) {
    if (
      !point ||
      typeof point.x !== 'number' ||
      Number.isNaN(point.x) ||
      typeof point.y !== 'number' ||
      Number.isNaN(point.y)
    ) {
      return { error: 'each point must include numeric x and y values' }
    }

    normalizedPoints.push({ x: point.x, y: point.y })
  }

  return {
    value: {
      roomId: roomId.trim(),
      strokeId: strokeId.trim(),
      tool,
      color: color.trim(),
      brushSize,
      points: normalizedPoints,
    },
  }
}

const normalizeJoinPayload = (payload = {}) => {
  const roomId = typeof payload.roomId === 'string' ? payload.roomId.trim() : ''

  if (!roomId) {
    return { error: 'roomId is required' }
  }

  return {
    value: {
      roomId,
    },
  }
}

const mapStrokeForClient = (strokeDocument, roomId) => ({
  roomId,
  strokeId: strokeDocument._id.toString(),
  tool: strokeDocument.tool,
  color: strokeDocument.color,
  brushSize: strokeDocument.brushSize,
  points: strokeDocument.points,
  userId: strokeDocument.user.toString(),
})

const leaveCurrentRoom = async (socket) => {
  if (!socket.data.roomId) {
    return
  }

  const roomId = socket.data.roomId
  const username = socket.data.user.username

  await socket.leave(roomId)
  await User.findByIdAndUpdate(socket.data.user.id, {
    $set: {
      activeRoom: null,
      socketId: null,
    },
  })

  socket.to(roomId).emit('user:left', {
    roomId,
    username,
    socketId: socket.id,
  })

  logger.info({ socketId: socket.id, roomId }, 'Socket left room')
  socket.data.roomId = null
}

const createWhiteboardSocketServer = (server, options = {}) => {
  const io = new Server(server, options)

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token

      if (!token) {
        logger.warn({ socketId: socket.id }, 'Socket rejected: missing auth token')
        return next(new Error('Authentication token is required for socket access'))
      }

      const payload = verifyAccessToken(token)
      const user = await User.findById(payload.sub).select('_id username email')

      if (!user) {
        logger.warn({ socketId: socket.id }, 'Socket rejected: authenticated user missing')
        return next(new Error('Authenticated user no longer exists'))
      }

      socket.data.user = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
      }

      return next()
    } catch (error) {
      logger.warn({ socketId: socket.id }, 'Socket rejected: invalid or expired auth token')
      return next(new Error('Invalid or expired authentication token'))
    }
  })

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id, email: socket.data.user.email }, 'Socket connected')

    socket.on('room:join', async (payload, callback) => {
      const normalized = normalizeJoinPayload(payload)

      if (normalized.error) {
        callback?.({ ok: false, message: normalized.error })
        return
      }

      const { roomId } = normalized.value
      const username = socket.data.user.username

      try {
        if (socket.data.roomId && socket.data.roomId !== roomId) {
          await leaveCurrentRoom(socket)
        }

        const room = await Room.findOneAndUpdate(
          { roomId },
          { $setOnInsert: { roomId, title: roomId } },
          { upsert: true, returnDocument: 'after' }
        )

        await User.findByIdAndUpdate(socket.data.user.id, {
          $set: {
            socketId: socket.id,
            activeRoom: room._id,
          },
        })

        await Room.findByIdAndUpdate(room._id, {
          $addToSet: { users: socket.data.user.id },
        })

        socket.data.roomId = roomId

        await socket.join(roomId)

        const persistedStrokes = await Stroke.find({ room: room._id }).sort({ createdAt: 1 }).lean()
        const bufferedStrokes = getBufferedStrokesForRoom(roomId)
        const history = persistedStrokes.map((stroke) => mapStrokeForClient(stroke, roomId)).concat(bufferedStrokes)

        socket.emit('room:joined', {
          roomId,
          username,
          history,
        })

        socket.to(roomId).emit('user:joined', {
          roomId,
          username,
          socketId: socket.id,
        })

        callback?.({ ok: true, roomId, historyCount: history.length })
        logger.info({ socketId: socket.id, roomId }, 'Socket joined room')
      } catch (error) {
        logger.error({ err: error, socketId: socket.id }, 'Join room failed')
        callback?.({ ok: false, message: 'Unable to join room' })
      }
    })

    socket.on('room:leave', async (_, callback) => {
      try {
        await leaveCurrentRoom(socket)
        callback?.({ ok: true })
      } catch (error) {
        logger.error({ err: error, socketId: socket.id }, 'Leave room failed')
        callback?.({ ok: false, message: 'Unable to leave room' })
      }
    })

    socket.on('stroke:add', async (payload, callback) => {
      const normalized = sanitizeStrokePayload(payload)

      if (normalized.error) {
        callback?.({ ok: false, message: normalized.error })
        return
      }

      const stroke = normalized.value

      if (!socket.data.roomId || socket.data.roomId !== stroke.roomId) {
        callback?.({ ok: false, message: 'Join the room before sending strokes' })
        return
      }

      const buffered = enqueueStroke({
        roomId: stroke.roomId,
        userId: socket.data.user.id,
        tool: stroke.tool,
        color: stroke.color,
        brushSize: stroke.brushSize,
        points: stroke.points,
        clientStrokeId: stroke.strokeId,
      })

      if (!buffered) {
        callback?.({ ok: false, message: 'Server is busy, try again shortly' })
        return
      }

      const message = {
        roomId: stroke.roomId,
        strokeId: stroke.strokeId,
        tool: stroke.tool,
        color: stroke.color,
        brushSize: stroke.brushSize,
        points: stroke.points,
        userId: socket.data.user.id,
        username: socket.data.user.username,
      }

      socket.to(stroke.roomId).emit('stroke:receive', message)
      callback?.({ ok: true, strokeId: stroke.strokeId })
      logger.info({ socketId: socket.id, roomId: stroke.roomId }, 'Stroke buffered and broadcast')
    })

    socket.on('disconnect', async (reason) => {
      try {
        await leaveCurrentRoom(socket)

        logger.info({ socketId: socket.id, reason }, 'Socket disconnected')
      } catch (error) {
        logger.error({ err: error, socketId: socket.id }, 'Disconnect cleanup failed')
      }
    })
  })

  return io
}

module.exports = {
  createWhiteboardSocketServer,
}