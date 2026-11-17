import { Response } from 'express'
import { BaseController } from '@Controllers/BaseController'
import { ProfileService } from '@Services/Profile/ProfileService'
import { DuckUpdateRequest } from '@Requests/Duck/DuckUpdateRequest'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

export class ProfileController extends BaseController {
  constructor(public profileService: ProfileService) {
    super()
  }

  public async me(request: IAuthRequest, response: Response): Promise<void> {
    try {
      this.ok(response, 'Success Get Profile!', await this.profileService.me(request.address!))
    } catch (error) {
      this.fail(response, error)
    }
  }

  public async updateDuck(request: IAuthRequest, response: Response): Promise<void> {
    try {
      const duckUpdateInput = new DuckUpdateRequest({
        address: request.address!,
        name: request.body.name,
        template: request.body.template,
        bodyColor: request.body.bodyColor,
        billColor: request.body.billColor,
        cosmetics: request.body.cosmetics,
        equippedPartTypeId: request.body.equippedPartTypeId ?? null,
      }).toDTO()

      this.ok(response, 'Duck saved', await this.profileService.updateDuck(duckUpdateInput))
    } catch (error) {
      this.fail(response, error)
    }
  }
}
