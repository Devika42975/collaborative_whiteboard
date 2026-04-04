import { useEffect, useRef, useState } from 'react'
import Toolbar from './Toolbar'
import { disconnectWhiteboardSocket, getWhiteboardSocket } from '../lib/socket'

const buildStrokeId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `stroke-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const drawStroke = (context, stroke) => {
  if (!stroke.points || stroke.points.length < 2) {
    return
  }

  context.save()
  context.lineWidth = stroke.brushSize
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (stroke.tool === 'eraser') {
    context.globalCompositeOperation = 'destination-out'
    context.strokeStyle = '#000000'
  } else {
    context.globalCompositeOperation = 'source-over'
    context.strokeStyle = stroke.color
  }

  context.beginPath()
  context.moveTo(stroke.points[0].x, stroke.points[0].y)

  for (let index = 1; index < stroke.points.length; index += 1) {
    context.lineTo(stroke.points[index].x, stroke.points[index].y)
  }

  context.stroke()
  context.restore()
}

const getCanvasPoint = (event, canvas) => {
  const rect = canvas.getBoundingClientRect()

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function Canvas({ roomId, token, user }) {
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef([])
  const joinedRoomRef = useRef(null)
  const [selectedTool, setSelectedTool] = useState('pen')
  const [color, setColor] = useState('#0f172a')
  const [brushSize, setBrushSize] = useState(3)
  const [connectionState, setConnectionState] = useState('Connecting...')
  const [roomStatus, setRoomStatus] = useState('Joining room...')

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    context.lineWidth = brushSize
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = color
  }, [brushSize, color])

  useEffect(() => {
    if (!token || !user) {
      joinedRoomRef.current = null
      disconnectWhiteboardSocket()
      return undefined
    }

    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const socket = getWhiteboardSocket()

    const handleConnect = () => {
      setConnectionState('Connected')
      setRoomStatus(`Joining room ${roomId}...`)
      socket.emit('room:join', { roomId }, (response) => {
        if (!response?.ok) {
          setRoomStatus(response?.message || 'Unable to join room')
        }
      })
    }

    const handleConnectError = (error) => {
      setConnectionState('Auth failed')
      setRoomStatus(error.message || 'Socket authentication failed')
    }

    const handleDisconnect = () => {
      setConnectionState('Disconnected')
      joinedRoomRef.current = null
    }

    const handleRoomJoined = (payload) => {
      joinedRoomRef.current = payload.roomId
      setRoomStatus(`Joined ${payload.roomId} as ${payload.username}`)
      context.clearRect(0, 0, canvas.width, canvas.height)

      for (const stroke of payload.history) {
        drawStroke(context, stroke)
      }
    }

    const handleUserJoined = (payload) => {
      setRoomStatus(`${payload.username} joined ${payload.roomId}`)
    }

    const handleUserLeft = (payload) => {
      setRoomStatus(`${payload.username} left ${payload.roomId}`)
    }

    const handleStrokeReceived = (stroke) => {
      drawStroke(context, stroke)
      setRoomStatus(`Synced stroke from ${stroke.username || 'another user'}`)
    }

    if (!socket.connected) {
      socket.connect()
    } else {
      handleConnect()
    }

    socket.on('connect', handleConnect)
    socket.on('connect_error', handleConnectError)
    socket.on('disconnect', handleDisconnect)
    socket.on('room:joined', handleRoomJoined)
    socket.on('user:joined', handleUserJoined)
    socket.on('user:left', handleUserLeft)
    socket.on('stroke:receive', handleStrokeReceived)

    return () => {
      socket.emit('room:leave')
      socket.off('connect', handleConnect)
      socket.off('connect_error', handleConnectError)
      socket.off('disconnect', handleDisconnect)
      socket.off('room:joined', handleRoomJoined)
      socket.off('user:joined', handleUserJoined)
      socket.off('user:left', handleUserLeft)
      socket.off('stroke:receive', handleStrokeReceived)
    }
  }, [roomId, token, user])

  const startDrawing = (event) => {
    if (joinedRoomRef.current !== roomId) {
      return
    }

    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const point = getCanvasPoint(event, canvas)

    context.lineWidth = brushSize
    context.lineCap = 'round'
    context.lineJoin = 'round'

    if (selectedTool === 'eraser') {
      context.globalCompositeOperation = 'destination-out'
    } else {
      context.globalCompositeOperation = 'source-over'
      context.strokeStyle = color
    }

    isDrawingRef.current = true
    currentStrokeRef.current = [point]
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  const draw = (event) => {
    if (!isDrawingRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const point = getCanvasPoint(event, canvas)

    currentStrokeRef.current.push(point)

    context.lineTo(point.x, point.y)
    context.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawingRef.current) {
      return
    }

    isDrawingRef.current = false
    const completedStroke = {
      roomId,
      strokeId: buildStrokeId(),
      tool: selectedTool,
      color,
      brushSize,
      points: currentStrokeRef.current,
    }

    currentStrokeRef.current = []

    if (completedStroke.points.length < 2) {
      return
    }

    const socket = getWhiteboardSocket()
    socket.emit('stroke:add', completedStroke, (response) => {
      if (!response?.ok) {
        setRoomStatus(response?.message || 'Stroke sync failed')
      }
    })
  }

  const clearBoard = () => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    context.clearRect(0, 0, canvas.width, canvas.height)
    currentStrokeRef.current = []
  }

  const displayConnectionState = token && user ? connectionState : 'Signed out'
  const displayRoomStatus = token && user ? roomStatus : 'Log in to join a room and sync strokes.'

  return (
    <div className="canvas-shell">
      <div className="canvas-status-bar">
        <span>Room: {roomId}</span>
        <span>User: {user?.username || 'Guest'}</span>
        <span>Status: {displayConnectionState}</span>
      </div>
      <p className="canvas-room-status">{displayRoomStatus}</p>

      <Toolbar
        selectedTool={selectedTool}
        color={color}
        brushSize={brushSize}
        onToolChange={setSelectedTool}
        onColorChange={setColor}
        onBrushSizeChange={setBrushSize}
        onClear={clearBoard}
      />

      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        className="whiteboard-canvas"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />
    </div>
  )
}

export default Canvas