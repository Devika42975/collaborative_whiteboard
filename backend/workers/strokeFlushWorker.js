const Room = require('../models/Room')
const Stroke = require('../models/Stroke')
const logger = require('../utils/logger')

const DEFAULT_FLUSH_INTERVAL_MS = Number(process.env.STROKE_FLUSH_INTERVAL_MS || 5000)
const DEFAULT_MAX_BUFFER_SIZE = Number(process.env.STROKE_BUFFER_MAX || 20000)

const strokeBufferByRoom = new Map()

let totalBufferedStrokes = 0
let flushTimer = null
let isFlushing = false

const appendStrokesToBuffer = (roomId, strokes) => {
  if (!strokes.length) {
    return
  }

  const roomBuffer = strokeBufferByRoom.get(roomId) || []
  roomBuffer.push(...strokes)
  strokeBufferByRoom.set(roomId, roomBuffer)
  totalBufferedStrokes += strokes.length
}

const enqueueStroke = ({ roomId, userId, tool, color, brushSize, points, clientStrokeId }) => {
  if (totalBufferedStrokes >= DEFAULT_MAX_BUFFER_SIZE) {
    logger.warn(
      { roomId, buffered: totalBufferedStrokes, maxBuffered: DEFAULT_MAX_BUFFER_SIZE },
      'Stroke buffer is full, dropping incoming stroke'
    )
    return false
  }

  appendStrokesToBuffer(roomId, [
    {
      roomId,
      userId,
      tool,
      color,
      brushSize,
      points,
      clientStrokeId,
      queuedAt: new Date(),
    },
  ])

  return true
}

const getBufferedStrokesForRoom = (roomId) => {
  const roomBuffer = strokeBufferByRoom.get(roomId) || []

  return roomBuffer.map((stroke, index) => ({
    roomId: stroke.roomId,
    strokeId: stroke.clientStrokeId || `buffered-${stroke.queuedAt.getTime()}-${index}`,
    tool: stroke.tool,
    color: stroke.color,
    brushSize: stroke.brushSize,
    points: stroke.points,
    userId: stroke.userId,
  }))
}

const snapshotAndClearBuffer = () => {
  const snapshot = new Map(strokeBufferByRoom)
  strokeBufferByRoom.clear()
  totalBufferedStrokes = 0
  return snapshot
}

const flushStrokeBufferNow = async (reason = 'interval') => {
  if (isFlushing || totalBufferedStrokes === 0) {
    return
  }

  isFlushing = true
  const snapshot = snapshotAndClearBuffer()

  try {
    let persistedCount = 0

    for (const [roomId, bufferedStrokes] of snapshot.entries()) {
      if (!bufferedStrokes.length) {
        continue
      }

      const room = await Room.findOne({ roomId }).select('_id')

      if (!room) {
        logger.warn({ roomId, count: bufferedStrokes.length }, 'Dropping buffered strokes for unknown room')
        continue
      }

      const strokeDocs = bufferedStrokes.map((stroke) => ({
        room: room._id,
        user: stroke.userId,
        tool: stroke.tool,
        color: stroke.color,
        brushSize: stroke.brushSize,
        points: stroke.points,
      }))

      const inserted = await Stroke.insertMany(strokeDocs, { ordered: false })

      if (inserted.length) {
        await Room.findByIdAndUpdate(room._id, {
          $push: {
            strokes: {
              $each: inserted.map((stroke) => stroke._id),
            },
          },
        })
      }

      persistedCount += inserted.length
    }

    logger.info(
      { reason, persistedCount, remainingBuffered: totalBufferedStrokes },
      'Flushed buffered strokes to MongoDB'
    )
  } catch (error) {
    for (const [roomId, bufferedStrokes] of snapshot.entries()) {
      appendStrokesToBuffer(roomId, bufferedStrokes)
    }

    logger.error({ err: error }, 'Stroke buffer flush failed, re-queued buffered strokes')
  } finally {
    isFlushing = false
  }
}

const startStrokeFlushWorker = () => {
  if (flushTimer) {
    return
  }

  flushTimer = setInterval(() => {
    flushStrokeBufferNow('interval').catch((error) => {
      logger.error({ err: error }, 'Unhandled error while flushing stroke buffer')
    })
  }, DEFAULT_FLUSH_INTERVAL_MS)

  logger.info(
    { flushIntervalMs: DEFAULT_FLUSH_INTERVAL_MS, maxBufferedStrokes: DEFAULT_MAX_BUFFER_SIZE },
    'Stroke flush worker started'
  )
}

const stopStrokeFlushWorker = () => {
  if (!flushTimer) {
    return
  }

  clearInterval(flushTimer)
  flushTimer = null
  logger.info('Stroke flush worker stopped')
}

module.exports = {
  enqueueStroke,
  getBufferedStrokesForRoom,
  flushStrokeBufferNow,
  startStrokeFlushWorker,
  stopStrokeFlushWorker,
}