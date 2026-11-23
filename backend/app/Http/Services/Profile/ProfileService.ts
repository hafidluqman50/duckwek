import { addresses, publicClient } from '@Chain/Contracts'
import { usdcAbi, vaultAbi } from '@Chain/abis'
import { env } from '@config/env'
import { PlayerRepository } from '@Repositories/Auth/PlayerRepository'
import { AuthNonceRepository } from '@Repositories/Auth/AuthNonceRepository'
import type { Address } from 'viem'
import { DuckRepository } from '@Repositories/Duck/DuckRepository'
import { PaymentRepository } from '@Repositories/Payment/PaymentRepository'
import { CatalogRepository } from '@Repositories/Catalog/CatalogRepository'
import { DuckUpdateDTO } from '@DTOs/DuckUpdateDTO'
import { Duck } from '@Models/Duck'
import { ForbiddenException } from '@Exceptions/ForbiddenException'
import { roomEvents } from '@Services/Room/RoomEvents'

export interface PublicDuck {
  name: string
  template: Duck['template']
  bodyColor: string
  billColor: string
  cosmetics: Duck['cosmetics']
  equippedPartTypeId: number | null
  races: number
  titles: number
  bestRank: number | null
  status: Duck['status']
}

export const toPublicDuck = (duck: Duck): PublicDuck => ({
  name: duck.name,
  template: duck.template,
  bodyColor: duck.body_color,
  billColor: duck.bill_color,
  cosmetics: duck.cosmetics,
  equippedPartTypeId: duck.equipped_part_type_id,
  races: duck.races,
  titles: duck.titles,
  bestRank: duck.best_rank,
  status: duck.status,
})

export class ProfileService {
  constructor(
    public duckRepository: DuckRepository,
    public paymentRepository: PaymentRepository,
    public catalogRepository: CatalogRepository,
    public playerRepository: PlayerRepository,
    public authNonceRepository: AuthNonceRepository,
  ) {}

  private async balances(address: string): Promise<{ usdc: bigint; earnings: bigint }> {
    const [balance, earnings, player, welcomeEnabled] = await Promise.all([
      publicClient.readContract({ address: addresses.usdc, abi: usdcAbi, functionName: 'balanceOf', args: [address as Address] }) as Promise<bigint>,
      publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: 'available', args: [address as Address] }) as Promise<bigint>,
      this.playerRepository.byAddress(address),
      publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: 'welcomeEnabled' }) as Promise<boolean>,
    ])
    const welcome = player && !player.first_spend_at && welcomeEnabled ? env.welcomeUsdc : 0n

    return { usdc: balance + welcome, earnings }
  }

  public async me(address: string) {
    const [duck, licenses, titles, activity, money, session] = await Promise.all([
      this.duckRepository.byAddress(address),
      this.duckRepository.licenses(address),
      this.duckRepository.titles(address),
      this.paymentRepository.activity(address),
      this.balances(address),
      this.authNonceRepository.activeSession(address),
    ])

    return {
      address,
      duck: duck ? toPublicDuck(duck) : null,
      usdc: money.usdc.toString(),
      earnings: money.earnings.toString(),
      session: session ? { limit: String(session.session_cap), spent: String(session.spent), deadline: String(session.deadline) } : null,
      parts: [...new Set(licenses.map((license) => license.type_id))],
      licenses: licenses.map((license) => ({ typeId: license.type_id, tokenId: license.token_id, tx: license.tx_hash })),
      titles: titles.map((title) => ({ title: title.title, rank: title.rank, room: title.room_code, raceId: title.race_id, tx: title.tx_hash })),
      activity: activity
        .filter((payment) => payment.status === 'confirmed' || payment.status === 'failed')
        .map((payment) => ({ kind: payment.kind, amount: String(payment.amount), status: payment.status, tx: payment.tx_hash, room: payment.room_code, at: payment.updated_at, label: (payment.meta as any)?.label || payment.kind })),
    }
  }

  public async updateDuck(duckUpdateInput: DuckUpdateDTO): Promise<PublicDuck> {
    if (duckUpdateInput.equippedPartTypeId !== null && !(await this.duckRepository.ownsPart(duckUpdateInput.address, duckUpdateInput.equippedPartTypeId))) {
      throw new ForbiddenException('You do not own that part yet')
    }

    const duck = await this.duckRepository.upsert(duckUpdateInput.address, {
      name: duckUpdateInput.name,
      template: duckUpdateInput.template,
      body_color: duckUpdateInput.bodyColor,
      bill_color: duckUpdateInput.billColor,
      cosmetics: duckUpdateInput.cosmetics,
      equipped_part_type_id: duckUpdateInput.equippedPartTypeId,
    })
    roomEvents.emit('duck:updated', duckUpdateInput.address)

    return toPublicDuck(duck)
  }
}
