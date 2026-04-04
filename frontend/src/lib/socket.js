import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

let whiteboardSocket
let socketToken = null

export const getWhiteboardSocket = () => {
  if (!whiteboardSocket) {
    whiteboardSocket = io(SOCKET_URL, {
      autoConnect: false,
      auth: {
        token: socketToken,
      },
      transports: ['websocket'],
    })
  }

  whiteboardSocket.auth = {
    token: socketToken,
  }

  return whiteboardSocket
}

export const setWhiteboardSocketToken = (token) => {
  const previousToken = socketToken
  socketToken = token

  if (whiteboardSocket) {
    whiteboardSocket.auth = { token }

    if (whiteboardSocket.connected && previousToken !== token) {
      whiteboardSocket.disconnect()
    }
  }
}

export const disconnectWhiteboardSocket = () => {
  if (whiteboardSocket?.connected) {
    whiteboardSocket.disconnect()
  }
}