'use client'

import { io, type Socket } from 'socket.io-client'
import { API_URL } from '@/lib/config'
import { tokenStore } from '@/http/client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { transports: ['websocket', 'polling'], reconnection: true })
    socket.on('connect', () => authSocket())
  }

  return socket
}

export function authSocket(): void {
  const token = tokenStore.get()

  if (token && socket?.connected) socket.emit('auth', { token })
}

export function watchRoom(code: string, handlers: Record<string, (message: any) => void>): () => void {
  const activeSocket = getSocket()
  const joinRoom = () => activeSocket.emit('room:watch', { code })

  activeSocket.on('connect', joinRoom)

  if (activeSocket.connected) joinRoom()

  for (const [eventName, handler] of Object.entries(handlers)) activeSocket.on(eventName, handler)

  return () => {
    activeSocket.off('connect', joinRoom)

    for (const [eventName, handler] of Object.entries(handlers)) activeSocket.off(eventName, handler)
  }
}
