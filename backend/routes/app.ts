import http from 'http'
import express, { Express, Request, Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import swaggerUI from 'swagger-ui-express'
import YAML from 'yamljs'
import path from 'path'
import { Server } from 'socket.io'
import '@Models/index'
import { connectDatabase } from '@config/database'
import { env } from '@config/env'
import { rpcStats } from '@Chain/RpcStats'
import { registerRaceGateway } from '@Sockets/RaceGateway'
import authRoutes from '@routes/auth/api'
import meRoutes from '@routes/me/api'
import catalogRoutes from '@routes/catalog/api'
import ordersRoutes from '@routes/orders/api'
import roomsRoutes from '@routes/rooms/api'
import withdrawRoutes from '@routes/withdraw/api'

const swaggerDocuments = YAML.load(path.join(__dirname, '..', 'api-duckwek-docs.yaml'))

const app: Express = express()
const server = http.createServer(app)
const origin = env.corsOrigins.includes('*') ? true : env.corsOrigins
const io = new Server(server, { cors: { origin }, transports: ['websocket', 'polling'], pingInterval: 10_000 })

app.use(cors({ origin }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({ message: 'DuckWek API · live duck racing on Monad' })
})
app.get('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: true, data: { chain: env.chainId, sockets: io.engine.clientsCount, rpc: rpcStats() } })
})

app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocuments))
app.use('/api/auth', authRoutes)
app.use('/api/me', meRoutes)
app.use('/api/catalog', catalogRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/rooms', roomsRoutes)
app.use('/api/withdraw', withdrawRoutes)

registerRaceGateway(io)

console.log(`
  |        API ENDPOINT           | METHOD |          DESCRIPTION                 |
  |-------------------------------|--------|--------------------------------------|
  | /api/auth/nonce               |  POST  | The session permit to sign (once)    |
  | /api/auth/verify              |  POST  | Verify the permit, JWT               |
  | /api/me                       |  GET   | Profile: duck, USDC, parts, titles   |
  | /api/me/duck                  |  PUT   | Save the duck (profile)              |
  | /api/catalog/tracks           |  GET   | Tracks                               |
  | /api/catalog/parts            |  GET   | Parts + track fit                    |
  | /api/orders                   |  POST  | Pay under the session, relayer gas   |
  | /api/rooms/:code              |  GET   | Room state                           |
  | /api/rooms/:code/loadout      |  PUT   | Part for this room                   |
  | /api/rooms/:code/start        |  POST  | Host starts the race                 |
  | /api/withdraw/prepare|submit  |  POST  | Pull payout of earnings (gasless)    |
  | socket.io  room:watch         |        | Lobby + race ticks (1 per step)      |
`)

const boot = async () => {
  await connectDatabase()
  server.listen(env.port, () => console.log(`[server]: Server is running at http://localhost:${env.port}`))
}

boot().catch((e) => {
  console.error(e)
  process.exit(1)
})

export { app, server, io }
