import { addresses, publicClient } from '@Chain/Contracts'
import { usdcAbi, vaultAbi } from '@Chain/abis'
import { env } from '@config/env'
import { PlayerRepository } from '@Repositories/Auth/PlayerRepository'
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
  tokenId: string | null
  hatchTx: string | null
}

export const toPublicDuck = (d: Duck): PublicDuck => ({
  name: d.name,
  template: d.template,
  bodyColor: d.body_color,
  billColor: d.bill_color,
  cosmetics: d.cosmetics,
  equippedPartTypeId: d.equipped_part_type_id,
  races: d.races,
  titles: d.titles,
  bestRank: d.best_rank,
  status: d.status,
  tokenId: d.token_id,
  hatchTx: d.tx_hash,
})

export class ProfileService {
  constructor(
    public duckRepository: DuckRepository,
    public paymentRepository: PaymentRepository,
    public catalogRepository: CatalogRepository,
    public playerRepository: PlayerRepository,
  ) {}

  /** USDC in the wallet, plus the welcome USDC that the first paid order mints, and what the Vault owes this address. */
  private async balances(address: string): Promise<{ usdc: bigint; earnings: bigint }> {
    const [balance, earnings, player] = await Promise.all([
      publicClient.readContract({ address: addresses.usdc, abi: usdcAbi, functionName: 'balanceOf', args: [address as Address] }) as Promise<bigint>,
      publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: 'available', args: [address as Address] }) as Promise<bigint>,
      this.playerRepository.byAddress(address),
    ])
    const welcome = player && !player.first_spend_at ? env.welcomeUsdc : 0n
    return { usdc: balance + welcome, earnings }
  }

  public async me(address: string) {
    const [duck, licenses, titles, activity, money] = await Promise.all([
      this.duckRepository.byAddress(address),
      this.duckRepository.licenses(address),
      this.duckRepository.titles(address),
      this.paymentRepository.activity(address),
      this.balances(address),
    ])
    return {
      address,
      duck: duck ? toPublicDuck(duck) : null,
      usdc: money.usdc.toString(),
      earnings: money.earnings.toString(),
      parts: [...new Set(licenses.map((l) => l.type_id))],
      licenses: licenses.map((l) => ({ typeId: l.type_id, tokenId: l.token_id, tx: l.tx_hash })),
      titles: titles.map((t) => ({ title: t.title, rank: t.rank, room: t.room_code, raceId: t.race_id, tx: t.tx_hash })),
      activity: activity
        .filter((p) => p.status === 'confirmed' || p.status === 'failed')
        .map((p) => ({ kind: p.kind, amount: String(p.amount), status: p.status, tx: p.tx_hash, room: p.room_code, at: p.updated_at, label: (p.meta as any)?.label || p.kind })),
    }
  }

  public async updateDuck(dto: DuckUpdateDTO): Promise<PublicDuck> {
    if (dto.equippedPartTypeId !== null && !(await this.duckRepository.ownsPart(dto.address, dto.equippedPartTypeId))) {
      throw new ForbiddenException('You do not own that part yet')
    }
    const duck = await this.duckRepository.upsert(dto.address, {
      name: dto.name,
      template: dto.template,
      body_color: dto.bodyColor,
      bill_color: dto.billColor,
      cosmetics: dto.cosmetics,
      equipped_part_type_id: dto.equippedPartTypeId,
    })
    roomEvents.emit('duck:updated', dto.address)
    return toPublicDuck(duck)
  }
}
