import { RoomService } from './RoomService'
import { roomRepository } from '@Repositories/Room'
import { duckRepository } from '@Repositories/Duck'
import { catalogService } from '@Services/Catalog'

const roomService = new RoomService(roomRepository, duckRepository, catalogService)

export { roomService }
