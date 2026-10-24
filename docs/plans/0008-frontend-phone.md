# Frontend Partial 1 — Phone App

| | |
|---|---|
| **Version** | 1.1 |
| **Status** | Approved |
| **Date Created** | 2026-10-24 |
| **Last Updated** | 2026-10-24 |

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-24 | Initial draft |
| 1.1 | 2026-10-24 | Approved by the owner; implementation follows the fixed behaviour |

---

## 1. Problem Statement

A person in the room scans a QR and has to be racing in under 15 seconds. They should not buy MON, approve a token, sign a transaction, or read a manual. The phone is also the only controller that changes the race: the CHEER button.

This partial defines the phone app: wallet connection, the one signature, the join and part flows, the duck profile, the live race screen and the result. It consumes the API from `0007` and the tick stream from `0006`. The projector is a separate partial (`0009`).

## 2. Definition of Done

1. `/` redirects to `/play`; `/join/[code]` redirects to `/play?room=CODE`.
2. A new player can connect, sign once, join a paid room and reach the lobby without another wallet prompt.
3. The duck draft (name, template, colors, cosmetics) saves and appears in the room.
4. A part can be bought, equipped in the garage and applied to the race.
5. The race screen shows the player's rank, progress, CHEER dock and the same tick as the stage.
6. The result screen shows the rank, soulbound title, hatch state and a way home or to a new room.
7. Withdraw prepares a typed data signature and submits it; the receiver pays no gas.
8. The app builds (`next build`) and has no horizontal scroll at 390 px.
9. No direct contract write happens without `simulateContract` first.

## 3. Feature Description

### 3.1 Routes

| Route | Purpose |
|---|---|
| `/` | Redirect to `/play` |
| `/play` | Phone app; optional `?room=CODE` |
| `/join/[code]` | QR target; redirects to `/play?room=CODE` |
| `/stage` and `/stage/[code]` | Projector, owned by `0009` |

### 3.2 Session and wallet

- Providers: wagmi + RainbowKit + React Query, Monad testnet chain `10143`.
- Signers: injected wallet (RainbowKit), passkey wallet, or device wallet. The fixed build supports all three; O-8 decides whether passkey ships on the demo build.
- Connect flow: `POST /api/auth/nonce` → wallet `signTypedData` (EIP-2612 permit, spender = Vault, cap and deadline from the server) → `POST /api/auth/verify` → JWT in `tokenStore`.
- The JWT is restored on reload; if it is invalid, the app returns to connect.
- The wallet popup appears once. Every later paid action uses the stored session.
- `switchChain` runs before signing if the wallet is on another chain.
- The wallet sheet shows the address, the USDC balance and the sign-out action.

### 3.3 Screen flow

```text
splash -> connect -> (invite? join : hatch/home)
join ticket -> lobby -> countdown -> race -> photo -> result
home -> my duck -> garage -> create room -> hosted -> lobby
```

| Screen | Purpose |
|---|---|
| `splash` | Logo and "Scan. Race. Win." + invite preview |
| `connect` | Wallet choice and the one-signature explanation |
| `join` | Room name, ticket 0.10 USDC, pay action |
| `hatch` | Duck name, template, colors, cosmetics, keep |
| `home` | Duck card, join by code, host a room, bottom navigation |
| `myduck` | Duck editor |
| `garage` | Part list, buy, equip, loadout for the room |
| `create` | Track, room name, max ducks, bots toggle, rent 1 USDC |
| `hosted` | Room code and stage URL |
| `lobby` | Players, grid order, loadout, host start |
| `countdown` | 3-2-1 |
| `race` | Rank, progress, CHEER dock, live feed |
| `photo` | Short photo finish |
| `result` | Rank, title, hatch, settle tx, home/new room |

### 3.4 Race screen and CHEER

- The phone reads `race:tick` and renders progress; it never simulates the race.
- The CHEER dock is fixed to the bottom safe area and never overlaps the track or the back action.
- Taps are rate-limited on the client for feedback, but the server is the authority (5 per second, 20% cap).
- A counted tap shows a short glow; a rejected tap shows nothing.
- The energy meter comes from `tick.en`; it is the same number the stage uses.
- `race:result` switches to the photo phase; `race:settled` adds the final transaction and titles.

### 3.5 Contract interaction rules

The phone does not submit payment transactions; the relayer does. The only wallet interactions are:

1. EIP-2612 permit signature at connect (not a transaction).
2. Withdrawal signature from `/api/withdraw/prepare`.

If a direct contract write is added later, it must use:

```ts
const { request } = await publicClient.simulateContract({ ... })
await writeContractAsync(request)
```

A simulation error is formatted before any wallet popup.

### 3.6 Design system

- Tokens and rules: `docs/design/DESIGN_SYSTEM.md`.
- Display: Lilita One; body: Rubik; mono: JetBrains Mono.
- Primary CTA: yellow `#FFC93C`, black outline, 56 px minimum.
- Background `#120B2E`, surface `#1E1446`, accent `#836EF9`.
- No horizontal scroll at 390 px; bottom actions within thumb reach.

### 3.7 Errors and connectivity

- A failed order shows the server message: no session, no USDC, price changed, room full, already joined.
- A socket disconnect shows "connection lost, retrying" and reconnects; the room state is fetched again.
- A rejected signature stays on the current screen with a retry action.
- No private key, JWT or signature is logged to the console.

## 4. Impacted Files

| File | Status | Purpose |
|---|---|---|
| `frontend/app/play/page.tsx` | `[NEW]` | Suspense wrapper |
| `frontend/app/play/ui.tsx` | `[NEW]` | Screen state machine and actions |
| `frontend/app/join/[code]/page.tsx` | `[NEW]` | QR redirect |
| `frontend/app/page.tsx` | `[NEW]` | Redirect to `/play` |
| `frontend/app/layout.tsx`, `globals.css`, `providers.tsx` | `[NEW]` | Fonts, theme, wagmi/RainbowKit |
| `frontend/components/play/Onboarding.tsx` | `[NEW]` | Splash, Connect, JoinTicket, Hatch |
| `frontend/components/play/Profile.tsx` | `[NEW]` | Home, MyDuck, Garage, CreateRoom, Hosted |
| `frontend/components/play/RaceScreens.tsx` | `[NEW]` | Lobby, Countdown, RaceView, PhotoFinish, Result |
| `frontend/components/play/Shell.tsx` | `[NEW]` | Header, Toast, SignSheet, WalletSheet, BottomNav |
| `frontend/components/duck/DuckSvg.tsx` | `[NEW]` | Duck portrait and sprite source |
| `frontend/components/ui/kit.tsx` | `[NEW]` | Button, Card, Pill, TrackThumb |
| `frontend/contexts/SessionContext.tsx` | `[NEW]` | Wallet, permit, JWT, withdraw signature |
| `frontend/http/**` | `[NEW]` | Auth, profile, catalog, orders, rooms, socket |
| `frontend/lib/{types,config,wagmi,passkey,sound,track,useRoomLive}.ts` | `[NEW]` | Types, clients, wallet, sound, live state |

### Reuse check

| `[NEW]` item | Existing material read | Why it cannot serve as-is |
|---|---|---|
| Phone app | Nothing exists in this repository | New implementation; consumes the API in `0007` |
| `SessionContext` | The fixed session contract in `0003` and the auth endpoints in `0007` | New client; must match the permit domain and JWT flow |
| Components and kit | `docs/design/DESIGN_SYSTEM.md` | New UI; the design tokens are reused, not the code |

## 5. Code Shape

```ts
type Screen = 'splash' | 'connect' | 'join' | 'hatch' | 'home' | 'myduck' | 'garage' | 'create' | 'hosted' | 'lobby'
type Draft = Pick<Duck, 'name' | 'template' | 'bodyColor' | 'billColor' | 'cosmetics' | 'equippedPartTypeId'>

function PlayPage(): JSX.Element
function useSession(): {
  address: string | null
  signerKind: 'wallet' | 'passkey' | 'device' | null
  connectWallet(): Promise<void>
  connectLocal(kind: 'passkey' | 'device'): Promise<void>
  signIn(): Promise<void>
  signOut(): void
  signWithdraw(): Promise<{ tx: string; url: string | null }>
}
function useRoomLive(code: string | null, opts?: { photoMs?: number }): {
  room, error, grid, tick, countdown, phase, result, settled, hatched, events, blockGap, cheers, reset
}
```

- `PlayPage` owns `screen`, `code`, `draft`, `busy`, `loadout` and the action handlers.
- `useRoomLive` owns the socket subscription and maps events to phases.
- `SessionContext` owns the wallet, the permit signature and the JWT.
- `components/play/*` are presentational; the page owns the API calls.

## 6. UI/UX Changes (Lo-Fi)

```text
┌─────────────────────────────┐
│  DUCKW EK        [balance]  │
│                             │
│   (duck portrait)           │
│   QuackZilla · Sprint       │
│                             │
│   [ JOIN ROOM — 0.10 USDC ] │
│   [ HOST A ROOM — 1 USDC ]  │
│                             │
│   Home   My Duck   Garage   │
└─────────────────────────────┘

RACE
┌─────────────────────────────┐
│  #4   ███████████░░░  72%   │
│                             │
│   track strip / pack        │
│                             │
│  [ CHEER ]  energy ████░    │
└─────────────────────────────┘
```

- The CHEER dock is its own bottom block; it never overlays the track.
- The result screen shows the title pill, the hatch transaction and a home action.
- The garage shows owned/not owned and the per-race loadout.

## 7. Flowchart

```mermaid
flowchart TD
  A[Scan QR] --> B[/join/CODE -> /play?room=CODE]
  B --> C{Session?}
  C -- no --> D[Connect + sign once]
  C -- yes --> E{In room?}
  D --> E
  E -- no --> F[Pay ticket 0.10]
  F --> G[Lobby]
  E -- yes --> G
  G --> H[Countdown]
  H --> I[Race + CHEER]
  I --> J[Photo finish]
  J --> K[Result + title + hatch]
  K --> L[Home / new room]
```

## 8. Verification Plan

| # | Check | Method |
|---|---|---|
| T-1 | Production build | `npm run build` |
| T-2 | Connect + one signature + join | Browser, fresh profile |
| T-3 | Reload restores the session | Browser reload |
| T-4 | Duck draft saves and appears on stage | Two devices |
| T-5 | Part purchase, equip and loadout | Browser |
| T-6 | Race tick and CHEER | Phone + stage in one room |
| T-7 | Result, title, hatch | Live race |
| T-8 | Withdraw signature and submit | Browser |
| T-9 | No horizontal scroll at 390×844 | DevTools |
| T-10 | Wallet wrong-network switch | Browser |
| T-11 | Socket reconnect | Toggle network |

### UNVERIFIED

| Claim | Why | Resolved by |
|---|---|---|
| Passkey works on venue phones | Browser and OS dependent | O-8 and a device test |
| WalletConnect on venue Wi-Fi | Network dependent | Demo rehearsal |
| 390 px layout on the actual phones | Device dependent | Manual check |

## 9. Open Decisions

| ID | Decision | Blocks | What the owner must provide |
|---|---|---|---|
| O-8 | Wallet onboarding | this plan | RainbowKit only, or also passkey/device wallet |
| O-2 | Room capacity in create | this plan | Confirm 100 max and the default |
| O-28 | Session policy | this plan | Confirm the cap and lifetime shown at connect |
| O-31 | Part shop timing | this plan | Buy before join, in the lobby, or both |
| O-32 | Result action | this plan | Home, new room, or both |
