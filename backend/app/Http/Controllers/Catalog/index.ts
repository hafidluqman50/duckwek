import { CatalogController } from './CatalogController'
import { catalogService } from '@Services/Catalog'

const catalogController = new CatalogController(catalogService)

export { catalogController }
