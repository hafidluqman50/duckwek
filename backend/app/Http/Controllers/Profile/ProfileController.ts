import { Response } from 'express'
import { BaseController } from '@Controllers/BaseController'
import { ProfileService } from '@Services/Profile/ProfileService'
import { DuckUpdateRequest } from '@Requests/Duck/DuckUpdateRequest'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

export class ProfileController extends BaseController {
  constructor(public profileService: ProfileService) {
    super()
  }

  public async me(req: IAuthRequest, res: Response): Promise<void> {
    try {
      this.ok(res, 'Success Get Profile!', await this.profileService.me(req.address!))
    } catch (e) {
      this.fail(res, e)
    }
  }

  public async updateDuck(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const dto = new DuckUpdateRequest({
        address: req.address!,
        name: req.body.name,
        template: req.body.template,
        bodyColor: req.body.bodyColor,
        billColor: req.body.billColor,
        cosmetics: req.body.cosmetics,
        equippedPartTypeId: req.body.equippedPartTypeId ?? null,
      }).toDTO()
      this.ok(res, 'Duck saved', await this.profileService.updateDuck(dto))
    } catch (e) {
      this.fail(res, e)
    }
  }
}
