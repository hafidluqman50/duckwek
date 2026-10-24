import { RaceService } from './RaceService'
import { roomRepository } from '@Repositories/Room'
import { raceRepository } from '@Repositories/Race'
import { duckRepository } from '@Repositories/Duck'
import { catalogRepository } from '@Repositories/Catalog'
import { roomService } from '@Services/Room'

const raceService = new RaceService(roomRepository, raceRepository, duckRepository, catalogRepository, roomService)

export { raceService }
