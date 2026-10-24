# DuckWek

Live room-wide duck racing on Monad. **One Monad block moves every duck one step.** Players pay a 0.10 USDC ticket, never hold MON, and the race can be replayed from the on-chain seed.

- **App:** https://duckwek-app.vercel.app
- **API:** https://duckwek-api.fly.dev
- **Chain:** Monad testnet, chain id `10143`
- **Repo:** https://github.com/hafidluqman50/duckwek

## Contracts

| Contract | Address |
|---|---|
| MockUSDC | `0x3fCE163857596ad26abc2dCD8E0144c14fBeE4cD` |
| TrackNFT | `0x891e4628e981901FaB0134741112953c786F3276` |
| PartNFT | `0x7e80d73B8341c26055335FaEd8516dA5f51F233C` |
| DuckNFT | `0x84a9Bf7e63B7e0a8d2C5872a5095F89485005249` |
| Badge | `0xb6aD315B8cd562e8AA86E9E577CabDdC9dF34A9C` |
| DuckWekVault | `0xC434C66A104b4351bb74917cC9408249A8cdA05d` |
| DuckWekRace | `0x88Dc8Df4045F8343A6b48f2cF0ade5AB8a9D6235` |

Deployment transaction (MockUSDC): `0x5e215a7117cbf7ecace329bec80b80b7d0d8cb1e58bb53424983f15f0f055333`. The full broadcast is in `smart-contract/broadcast/Deploy.s.sol/10143/`.

There is no proxy. The contracts are immutable; a future change is a migration (`docs/plans/0002-mainnet-migration.md`).

## How it works

- One signature at connect: EIP-2612 permit for the Vault. The relayer submits and pays gas.
- Host creates a room for 1 USDC; the rent covers the host's entry.
- Player joins for 0.10 USDC; the ticket is a fee, not a bet.
- `DuckWekRace.start` fixes `startBlock` and the seed from `prevrandao`; the relayer sends one tick transaction per block.
- Positions, overtakes and CHEER are computed off-chain from the seed and the published step count. The chain records the seed, the ticks, the standing root and the podium.
- A part is a 1 USDC license with a 5% ERC-2981 royalty. A badge is soulbound and cannot be bought.

## Layout

```text
smart-contract/   Foundry: fixed contracts, tests, deploy script
backend/          Express + TypeScript + Sequelize + Socket.io + viem
frontend/         Next.js 16 + Tailwind 4 + RainbowKit/wagmi
docs/plans/       the approved work plans and migration playbook
docs/design/      design tokens and UI rules
FINANCE.md        prices and splits, aligned with the contracts
```

## Run locally

### Contracts

```bash
cd smart-contract
forge test
PRIVATE_KEY=... OPERATOR=0x... TREASURY=0x... \
  forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast
./script/export-abi.sh
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
# fill JWT_SECRET, RPC_URL, OPERATOR_PRIVATE_KEY, the contract addresses, PostgreSQL
npm run migrate:latest
npm run seed:run
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
# phone: http://localhost:3000/play
# projector: http://localhost:3000/stage/WEK-XXX
```

## Tests

| Test | Command |
|---|---|
| Contracts | `cd smart-contract && forge test` (60 tests) |
| Engine fairness and cheer | `cd backend && npx ts-node -T test/engine/fairness.test.ts` |
| End to end | `cd backend && npm run test:e2e` |
| Load | `cd backend && N=50 W=200 npm run test:load` |
| Frontend build | `cd frontend && npm run build` |

## Demo

1. Scan the stage QR.
2. Connect once, pay the 0.10 USDC ticket.
3. Race; tap CHEER.
4. Photo finish, podium, soulbound titles.
5. Hatch the duck, withdraw from the Vault.
6. Show one tick transaction, the start transaction and the finalize transaction.

## Proof

The deployment transaction is listed above. Race proof (create, join, start, tick, finalize, hatch, withdraw) is added after the first live race.
