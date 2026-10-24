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

  public async show(req: Request, res: Response): Promise<void> {
    try {
      const code = String(req.params.code).toUpperCase()
      const state = await this.roomService.state(code, this.raceService.status(code))
      this.ok(res, 'Success Get Room!', { ...state, lastResult: this.raceService.lastResult(code) })
    } catch (e) {
      this.fail(res, e)
    }
  }

  public async loadout(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const dto = new LoadoutRequest({ address: req.address!, roomCode: String(req.params.code), partTypeId: req.body.partTypeId ?? null }).toDTO()
      await this.roomService.setLoadout(dto)
      this.ok(res, 'Loadout saved', { partTypeId: dto.partTypeId })
    } catch (e) {
      this.fail(res, e)
    }
  }

  public async start(req: IAuthRequest, res: Response): Promise<void> {
    try {
      this.ok(res, 'Race starting', await this.raceService.start(String(req.params.code).toUpperCase(), req.address!))
    } catch (e) {
      this.fail(res, e)
    }
  }
}
