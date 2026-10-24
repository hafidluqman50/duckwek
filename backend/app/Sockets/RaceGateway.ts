import type { Server, Socket } from 'socket.io'
import { roomEvents } from '@Services/Room/RoomEvents'
import { roomService } from '@Services/Room'
import { raceService } from '@Services/Race'
import { verifyToken } from '@Middlewares/AuthenticationMiddleware'

/**
 * Socket.io: phones and the projector join a socket room named after the room code.
 *  client → 'room:watch' { code }            server → 'room:state', and if a race is live 'race:grid' + 'race:tick'
 *  server → 'race:grid' | 'race:countdown' | 'race:go' | 'race:tick' | 'race:result' | 'race:settled' | 'duck:hatched'
 * Everything a phone does that costs money goes through the REST API; sockets only carry state. The one thing a phone sends over the
 * socket that changes a race is CHEER (plan §3.10): the socket first says who it is ('auth' with the JWT), and RaceService decides
 * whether a tap counts.
 */
export const registerRaceGateway = (io: Server): void => {
  const pushState = async (code: string) => {
    try {
      io.to(code).emit('room:state', await roomService.state(code, raceService.status(code)))
    } catch (e) {
      /* room may not exist */
    }
  }

  roomEvents.on('broadcast', (code: string, event: string, payload: unknown) => {
    io.to(code).emit(event, payload)
    if (event === 'race:result' || event === 'race:grid') pushState(code)
  })
  roomEvents.on('room:changed', (code: string) => pushState(code))
  roomEvents.on('duck:updated', async (address: string) => {
    const codes = await roomService.refreshDuckInRooms(address)
    for (const c of codes) pushState(c)
  })

  io.on('connection', (socket: Socket) => {
    let lastFeed = 0
    socket.data.address = null
    socket.on('auth', (m: { token?: string }) => {
      socket.data.address = m?.token ? verifyToken(String(m.token)) : null
    })
    // CHEER: counted by the race only for a paid human entrant of the room while it runs, at most 5 per second. The projector's
    // "+1 name" feed shows at most one per player per 400 ms of the taps that counted.
    socket.on('race:cheer', () => {
      const address = socket.data.address as string | null
      const code = [...socket.rooms].find((r) => r !== socket.id)
      if (!address || !code) return
      const counted = raceService.cheer(code, address)
      if (!counted) return
      const now = Date.now()
      if (now - lastFeed < 400) return
      lastFeed = now
      io.to(code).emit('race:cheer', { name: counted.name.slice(0, 14) })
    })
    socket.on('room:watch', async (msg: { code?: string }) => {
      const code = String(msg?.code || '').toUpperCase()
      if (!/^WEK-[A-Z0-9]{3,6}$/.test(code)) return
      for (const r of socket.rooms) if (r !== socket.id) socket.leave(r)
      socket.join(code)
      try {
        socket.emit('room:state', await roomService.state(code, raceService.status(code)))
        const grid = raceService.grid(code)
        if (grid) socket.emit('race:grid', grid)
        const snap = raceService.snapshot(code)
        if (snap) socket.emit('race:tick', { ...snap, ev: [] })
      } catch {
        socket.emit('room:error', { message: 'Room not found' })
      }
    })
  })
}
