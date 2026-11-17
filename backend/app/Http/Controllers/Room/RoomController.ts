import { Request, Response } from 'express'
import { BaseController } from '@Controllers/BaseController'
import { RoomService } from '@Services/Room/RoomService'
import { RaceService } from '@Services/Race/RaceService'
import { LoadoutRequest } from '@Requests/Room/LoadoutRequest'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

export class RoomController extends BaseController {
  constructor(public roomService: RoomService, public raceService: RaceService) {
    super()
  }

  public async show(request: Request, response: Response): Promise<void> {
    try {
      const code = String(request.params.code).toUpperCase()
      const state = await this.roomService.state(code, this.raceService.status(code))

      this.ok(response, 'Success Get Room!', { ...state, lastResult: this.raceService.lastResult(code) })
    } catch (error) {
      this.fail(response, error)
    }
  }

  public async loadout(request: IAuthRequest, response: Response): Promise<void> {
    try {
      const loadoutInput = new LoadoutRequest({ address: request.address!, roomCode: String(request.params.code), partTypeId: request.body.partTypeId ?? null }).toDTO()
      await this.roomService.setLoadout(loadoutInput)

      this.ok(response, 'Loadout saved', { partTypeId: loadoutInput.partTypeId })
    } catch (error) {
      this.fail(response, error)
    }
  }

  public async start(request: IAuthRequest, response: Response): Promise<void> {
    try {
      this.ok(response, 'Race starting', await this.raceService.start(String(request.params.code).toUpperCase(), request.address!))
    } catch (error) {
      this.fail(response, error)
    }
  }
}
