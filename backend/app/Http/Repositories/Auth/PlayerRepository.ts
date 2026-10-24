import { Player } from '@Models/Player'

export class PlayerRepository {
  public async findOrCreate(address: string): Promise<{ player: Player; created: boolean }> {
    const [player, created] = await Player.findOrCreate({ where: { address }, defaults: { address, name: address.slice(0, 8) } })
    return { player, created }
  }

  public async byAddress(address: string): Promise<Player | null> {
    return Player.findByPk(address)
  }

  /** The welcome USDC is minted inside the first paid order of a wallet, so this is the moment it is gone. */
  public async markFirstSpend(address: string): Promise<void> {
    await Player.update({ first_spend_at: new Date() }, { where: { address, first_spend_at: null } })
  }
}
