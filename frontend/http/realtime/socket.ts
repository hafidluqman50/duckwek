'use client'

import { io, type Socket } from 'socket.io-client'
import { API_URL } from '@/lib/config'
import { tokenStore } from '@/http/client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { transports: ['websocket', 'polling'], reconnection: true })
    socket.on('connect', () => authSocket()) // also after every reconnect
  }
  return socket
}

/** Tells the server who this socket is (the session token), so a CHEER tap can count. Watching a room needs no identity. */
export function authSocket(): void {
  const token = tokenStore.get()
  if (token && socket?.connected) socket.emit('auth', { token })
}

/** Watch one room. Re-sends room:watch after every reconnect. Returns an unsubscribe. */
export function watchRoom(code: string, handlers: Record<string, (m: any) => void>): () => void {
  const s = getSocket()
  const join = () => s.emit('room:watch', { code })
  s.on('connect', join)
  if (s.connected) join()
  for (const [ev, fn] of Object.entries(handlers)) s.on(ev, fn)
  return () => {
    s.off('connect', join)
    for (const [ev, fn] of Object.entries(handlers)) s.off(ev, fn)
  }
}
