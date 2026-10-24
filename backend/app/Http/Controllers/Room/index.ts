import { RoomController } from './RoomController'
import { roomService } from '@Services/Room'
import { raceService } from '@Services/Race'

const roomController = new RoomController(roomService, raceService)

export { roomController }
