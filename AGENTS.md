# DuckWek — Agent Context & Repository Rules

> [!IMPORTANT]
> Single source of truth for AI agents and developers in this repository. The rules below are **strict and non-negotiable**. Adapted from PulsarFi `AGENTS.md`.

DuckWek is live room-wide duck racing on Monad (one race step per block). This repository is the **public submission build** for Monad Blitz Jogja Vol. 2 (24 Oct 2026, GIK UGM). Product, economy and architecture: `README.md`, `FINANCE.md`.

---

## 1. Working Rules (owner: Luqman)

1. **Plan first, code later.** Write the plan in `docs/plans/`, wait for explicit approval, only then touch code. Coding before approval is the main past failure.
2. **Ask before starting.** Change nothing that was not requested.
3. **No assumptions.** No "I think" / "probably". Verify against a primary source (official docs, the chain) or measure.
4. **Pragmatic.** On-chain cost must stay small. Do not bring expensive designs.
5. **Answer the question asked, directly.** Do not widen into options nobody asked for.
6. **No artifacts or documents outside the repo** unless asked. Plans live in `docs/plans/`.
7. **Language.** Chat with the owner in Indonesian. All UI copy is English. Plan documents are English.
8. **No proxy.** The contracts are immutable. A future change that cannot fit them is a migration, planned in `docs/plans/0002-mainnet-migration.md`; no proxy contract is written.

---

## 2. Directory Boundaries

### 2.1 Backend (`backend/`, Express + TypeScript + Sequelize + PostgreSQL + Socket.io + viem)
- Follow the car-rental layout: `app/Http/{Controllers,Services,Repositories,Requests,Middlewares}`, `app/{DTOs,Interfaces,Models,Exceptions,Engine,Chain,Sockets}`, `config/`, `routes/`, `database/{migrations,seeders}`.
- **ALL tests, load tests and scratch scripts live in `backend/test/`** (`e2e/`, `engine/`, `load/`). Never place them inside `backend/app/`, `routes/` or `config/`.
- Migrations are not run by `npm run dev`: `npm run migrate:latest && npm run seed:run`.
- Live races and sockets are in memory: the API runs on exactly one machine (see `fly.toml`).

### 2.2 Frontend (`frontend/`, Next.js 16 + Tailwind 4 + RainbowKit/wagmi)
- Production code only in `app/`, `components/`, `contexts/`, `http/`, `lib/`. Tests, if any, go in `frontend/__tests__/`.
- Use Tailwind utility classes. Preserve the approved v3 design 1:1; tokens and UI rules are in `docs/design/DESIGN_SYSTEM.md`.
- Next.js 16 differs from older versions: read the relevant guide in `node_modules/next/dist/docs/` before writing Next code.

### 2.3 Smart Contract (`smart-contract/`, Foundry, solc 0.8.26, OpenZeppelin v5.1.0)
- `src/` is production Solidity only (`src/mocks/` is the only place for mocks). All Foundry tests (`*.t.sol`) live in `test/`.
- **Never edit `smart-contract/lib/**`.** Treat dependencies as read-only.
- After any ABI change run `./script/export-abi.sh` (copies ABIs to backend and frontend).

### 2.4 Docs (`docs/plans/`)
- Work plans, specs and changelogs, numbered and sequential: `docs/plans/0001-theme-and-scope.md`, `0002-mainnet-migration.md`, `0003-contracts-foundation.md`, and onward. Each plan covers one feature partial; later features use the next number.

---

## 3. Workplanning Sequence: Docs -> Implementation

1. **Update the plan first.** Every feature, fix or architectural change is documented in `docs/plans/` first (version bump + changelog row).
2. **Implement second**, only after the plan is approved.
3. Never touch code before the plan is updated.

---

## 4. Planning Mode Rules

1. **No code in Planning Mode.** No file edits or state-changing commands until the plan is approved.
2. **Version every plan edit, zero tolerance.** Every edit, however small (wording, field name, one-line clarification), bumps the version and adds a changelog row naming the section and what changed. MINOR for content revisions; MAJOR only when the approach or scope invalidates the prior plan.
3. **English only.**
4. **Required sections:** Problem Statement, Definition of Done, Feature Description, Impacted Files, Code Shape (whenever code changes), UI/UX Changes (Lo-Fi), Flowchart, Verification Plan.
5. **Header**, immediately followed by the changelog table (from `1.0` onward):
   ```markdown
   # <Feature Name>

   | | |
   |---|---|
   | **Version** | 1.0 |
   | **Status** | Draft |
   | **Date Created** | YYYY-MM-DD |
   | **Last Updated** | YYYY-MM-DD |

   | Version | Date | Change |
   |---|---|---|
   | 1.0 | YYYY-MM-DD | Initial draft |
   ```
6. **Code Shape** shows the code after the change: Before/After for every modified function or type, **New** types/functions with full signatures and a one-line responsibility, the **Call flow**, and **Deleted** symbols. Anything not verified against library source or a running test is marked `UNVERIFIED`, and the Verification Plan names the test that resolves it.
7. **Reuse check** for every `[NEW]` item in Impacted Files: state what existing code was read and why it could not serve. Follow sibling file naming and layout. Do not add a table, migration, interface or abstraction where an existing one works.

---

## 5. Frontend Contract Simulation

Every on-chain call from the frontend (permit, order, join, withdraw) must be pre-flight simulated:
```typescript
const { request } = await publicClient.simulateContract({ ... });
await writeContractAsync(request);
```
Calling `writeContractAsync` without simulation is prohibited. Format simulation errors before any wallet popup.

---

## 6. Product & Chain Rules

- **No prize pool, no betting.** Tickets and fees only; nothing flows from losers to winners (KUHP 303 / UU ITE / maysir risk). Podium gets soulbound titles that cannot be bought.
- **Payments are (Mock) USDC only.** MON is gas, paid by the relayer (EIP-2612 permit + EIP-712 order). Players never hold MON.
- **Pull payout.** Receivers withdraw themselves from the Vault.
- **One duck per wallet.** Egg until the first paid race, then hatch into a Duck NFT.
- **Do NOT compute standing or simulate the race on-chain.** Benchmarked and rejected (200 ducks on Alpine = 14.36M gas). Race and standing are computed off-chain from seed + `startBlock` + participant list; the chain records commits and results only.
- **Never use 200 as a participant count.** 200 is the max slots; participants are those who actually joined. Bots are visual only.
- **Monad gas is charged on gas limit, not gas used.** Set gas limits deliberately (per-tx 30M, per-block 150M).
- Unverified facts (e.g. `BLOCKHASH` / `PREVRANDAO` on Monad, Pyth Entropy reveal delay) must be checked against official docs before a design depends on them.
- Pricing and splits live in `FINANCE.md`; do not hardcode divergent values. `FINANCE.md` is mode `0600`, keep it that way.
- The agreed on-chain flow (create room with `hash(seed)` -> join pays ticket -> start reveals seed + merkle root of participants -> off-chain race -> finalize merkle root of standing) must follow the contract plans `0002`–`0005`. Open decisions are listed in `docs/plans/0001-theme-and-scope.md` §9; ask the owner, do not decide them silently.

---

## 7. Error & Logging Rules

- No silent failures: a swallowed error must be logged with the room code and enough context to reproduce it.
- Do not log or expose private keys, JWTs or signatures meant to stay server-side (`OPERATOR_PRIVATE_KEY`, `RESULT_SIGNER_PRIVATE_KEY`). Never commit `.env` / `.env.local`.
- Validate all external input (Joi in `app/Http/Requests`) before it reaches a service.
