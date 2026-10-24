import { ProfileController } from './ProfileController'
import { profileService } from '@Services/Profile'

const profileController = new ProfileController(profileService)

export { profileController }
