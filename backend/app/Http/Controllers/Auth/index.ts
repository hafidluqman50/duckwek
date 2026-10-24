import { AuthController } from './AuthController'
import { authService } from '@Services/Auth'

const authController = new AuthController(authService)

export { authController }
