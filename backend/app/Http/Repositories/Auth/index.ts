import { PlayerRepository } from './PlayerRepository'
import { AuthNonceRepository } from './AuthNonceRepository'

const playerRepository = new PlayerRepository()
const authNonceRepository = new AuthNonceRepository()

export { playerRepository, authNonceRepository }
