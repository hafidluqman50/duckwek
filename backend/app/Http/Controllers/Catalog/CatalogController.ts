import { Request, Response } from 'express'
import { BaseController } from '@Controllers/BaseController'
import { CatalogService } from '@Services/Catalog/CatalogService'

export class CatalogController extends BaseController {
  constructor(public catalogService: CatalogService) {
    super()
  }

  public async tracks(_request: Request, response: Response): Promise<void> {
    try {
      this.ok(response, 'Success Get Tracks!', await this.catalogService.tracks())
    } catch (error) {
      this.fail(response, error)
    }
  }

  public async parts(_request: Request, response: Response): Promise<void> {
    try {
      this.ok(response, 'Success Get Parts!', await this.catalogService.parts())
    } catch (error) {
      this.fail(response, error)
    }
  }
}
