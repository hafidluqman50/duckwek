import { AuthService } from './AuthService'
import { playerRepository, authNonceRepository } from '@Repositories/Auth'

const authService = new AuthService(playerRepository, authNonceRepository)

export { authService }
