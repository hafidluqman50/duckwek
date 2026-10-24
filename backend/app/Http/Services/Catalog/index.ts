import { CatalogService } from './CatalogService'
import { catalogRepository } from '@Repositories/Catalog'

const catalogService = new CatalogService(catalogRepository)

export { catalogService }
