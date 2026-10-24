import { Request, Response } from 'express'
import { BaseController } from '@Controllers/BaseController'
import { CatalogService } from '@Services/Catalog/CatalogService'

export class CatalogController extends BaseController {
  constructor(public catalogService: CatalogService) {
    super()
  }

  public async tracks(_req: Request, res: Response): Promise<void> {
    try {
      this.ok(res, 'Success Get Tracks!', await this.catalogService.tracks())
    } catch (e) {
      this.fail(res, e)
    }
  }

  public async parts(_req: Request, res: Response): Promise<void> {
    try {
      this.ok(res, 'Success Get Parts!', await this.catalogService.parts())
    } catch (e) {
      this.fail(res, e)
    }
  }
}
