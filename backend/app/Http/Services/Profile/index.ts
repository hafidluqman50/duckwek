import { ProfileService } from './ProfileService'
import { duckRepository } from '@Repositories/Duck'
import { paymentRepository } from '@Repositories/Payment'
import { catalogRepository } from '@Repositories/Catalog'
import { playerRepository, authNonceRepository } from '@Repositories/Auth'

const profileService = new ProfileService(duckRepository, paymentRepository, catalogRepository, playerRepository, authNonceRepository)

export { profileService }
