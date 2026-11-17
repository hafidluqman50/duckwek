import type { Server, Socket } from 'socket.io'
import { roomEvents } from '@Services/Room/RoomEvents'
import { roomService } from '@Services/Room'
import { raceService } from '@Services/Race'
import { verifyToken } from '@Middlewares/AuthenticationMiddleware'

const CHEER_FEED_INTERVAL_MS = 400
const CHEER_NAME_MAX_LENGTH = 14

export const registerRaceGateway = (io: Server): void => {
  const pushStateIfRoomExists = async (code: string) => {
    try {
      io.to(code).emit('room:state', await roomService.state(code, raceService.status(code)))
    } catch {
      return
    }
  }

  roomEvents.on('broadcast', (code: string, event: string, payload: unknown) => {
    io.to(code).emit(event, payload)

    if (event === 'race:result' || event === 'race:grid') pushStateIfRoomExists(code)
  })
  roomEvents.on('room:changed', (code: string) => pushStateIfRoomExists(code))
  roomEvents.on('duck:updated', async (address: string) => {
    const codes = await roomService.refreshDuckInRooms(address)

    for (const code of codes) pushStateIfRoomExists(code)
  })

  io.on('connection', (socket: Socket) => {
    let lastFeedAt = 0
    socket.data.address = null
    socket.on('auth', (message: { token?: string }) => {
      socket.data.address = message?.token ? verifyToken(String(message.token)) : null
    })
    socket.on('race:cheer', () => {
      const address = socket.data.address as string | null
      const code = [...socket.rooms].find((roomName) => roomName !== socket.id)

      if (!address || !code) return

      const counted = raceService.cheer(code, address)

      if (!counted) return

      const now = Date.now()

      if (now - lastFeedAt < CHEER_FEED_INTERVAL_MS) return

      lastFeedAt = now
      io.to(code).emit('race:cheer', { name: counted.name.slice(0, CHEER_NAME_MAX_LENGTH) })
    })
    socket.on('room:watch', async (message: { code?: string }) => {
      const code = String(message?.code || '').toUpperCase()

      if (!/^WEK-[A-Z0-9]{3,6}$/.test(code)) return

      for (const roomName of socket.rooms) if (roomName !== socket.id) socket.leave(roomName)

      socket.join(code)

      try {
        socket.emit('room:state', await roomService.state(code, raceService.status(code)))
        const grid = raceService.grid(code)

        if (grid) socket.emit('race:grid', grid)

        const snapshot = raceService.snapshot(code)

        if (snapshot) socket.emit('race:tick', { ...snapshot, ev: [] })
      } catch {
        socket.emit('room:error', { message: 'Room not found' })
      }
    })
  })
}
