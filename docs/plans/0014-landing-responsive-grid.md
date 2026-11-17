# Landing Page, Responsive Play and MotoGP Grid

| | |
|---|---|
| **Version** | 1.3 |
| **Status** | Approved |
| **Date Created** | 2026-11-16 |
| **Last Updated** | 2026-11-16 |

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-16 | Initial draft from the approved canvas designs (`docs/design/v2/`) |
| 1.1 | 2026-11-16 | Owner approved. §9 Q1–Q3, Q5 closed. §2 DoD 3/9: "Host a room" → `/play/create` (new route, same `PlayPage`, starts on `create`); copy lint uses an allowlist for denial phrases ("No prize pool", "No betting"). §4: added `app/play/create/page.tsx`, move `spriteOf` out of stage `ui.tsx`, landing contracts table reads `lib/config.ts`. §5 U1 resolved: Standard "No Charge" GSAP licence covers commercial use incl. plugins (owner pasted licence text 2026-11-16); lockfile pins the version. §8: tests are `.mjs` scripts in `frontend/__tests__/`, Playwright only for screenshots. |
| 1.2 | 2026-11-16 | Implementation notes. §1/§3.1 landing contracts table: `lib/config.ts` had no addresses (the frontend talks to the backend only), so it now exposes `CONTRACTS` from `NEXT_PUBLIC_*_ADDRESS` env vars (documented in `.env.example`); a missing address hides its row, the header follows `NEXT_PUBLIC_CHAIN_ID`. §4: hook is `lib/useScrollStory.ts` (Impacted Files wins over the §5 path); `slotOf` lives in `lib/gridSlot.ts` (pure, testable by `node --experimental-strip-types`) instead of `MotoGrid.tsx`; `MotoGrid` draws the whole grid on one canvas (only slots in the camera window), `GridMinimap` is separate; `RacePanel` added to `RaceScreens.tsx`; `useWide` hook added. §3.2: the right panel is built for the race screen only; room info / part detail panels for home, lobby, garage are NOT built (those screens use 2 columns). §2 DoD 9 copy lint is scoped to the 0014 surfaces; existing Garage / My Duck copy ("Duck NFT", rarity) is removed by plan 0013. `/play/create` URL is kept with `history.replaceState` so the component stays mounted. The landing demo counter is labelled DEMO. |
| 1.3 | 2026-11-17 | Verification run on the staging deployment: `next build` passes (routes `/`, `/play`, `/play/create`, `/stage`, `/stage/[code]`, `/join/[code]`); landing checked at 1440 px and at a true 390 px viewport (menu, stacked CTAs, demo lane fit, no horizontal overflow); `/play` splash unchanged on phone. Still open: 768 and 1024 px, the 200-entrant fps measurement (U3), Lighthouse, reduced motion. |

> **Handoff to Claude Code.** Read `AGENTS.md`, `docs/design/DESIGN_SYSTEM.md` and `docs/design/v2/README.md` first. Draft: no code until the owner sets Status to Approved. This plan is frontend only and does **not** depend on the v2 contracts (`0013`); it can ship on the current build. Copy that names contracts (addresses table on the landing) reads from `frontend/lib/config.ts`, so it switches to v2 by config.

---

## 1. Problem Statement

1. `/` redirects to `/play`. There is no page that explains DuckWek to someone who is not in the room, and nothing to link from socials or the pitch.
2. `/play` is locked to a 440 px column (`app/play/ui.tsx`, `maxWidth: 440`). On a laptop it looks like a phone floating in a purple field.
3. The stage starting grid is a flat 20-column table (`app/stage/[code]/ui.tsx`, "STARTING GRID"). The owner wants a MotoGP-style grid.

## 2. Definition of Done

1. `/` is a landing page matching `landing-desktop.dc.html` and, at ≤ 430 px, `landing-phone.dc.html`. CTAs: **Play now** → `/play`, **Host a room** → `/play` host flow.
2. Landing motion per `docs/design/v2/README.md` (GSAP + ScrollTrigger), loaded only on `/`. `prefers-reduced-motion` shows a static page with all content.
3. `/join/[code]` still redirects to `/play?room=CODE`. Old links to `/` from QR codes keep working (QR points to `/join/...`, verify).
4. `/play` at ≥ 1024 px uses the 2-column layout of `play-laptop-race.dc.html` (sidebar nav, main, right panel with CHEER). Below 1024 px nothing changes visually.
5. CHEER on laptop also works with the Space key while the race screen is focused (owner to confirm, Q2).
6. Stage countdown shows the MotoGP grid (`stage-motogp-grid.dc.html`): rows of 3, staggered, numbered slots, pole by the start line, camera flyover pole → last row → pole, minimap. Order = join order (`e.i`). No engine or contract change.
7. Phone during countdown shows "your grid slot" (`play-phone-grid.dc.html`): P-number, row, local 3×3 grid around the player.
8. Lighthouse on `/` (mobile): no layout shift from the motion; LCP element is the hero headline.
9. No UI copy says bet, stake, jackpot, prize pool, rare, epic, Duck NFT.

## 3. Feature Description

### 3.1 Landing `/`
Sections (copy is in the design files; keep it verbatim unless the owner edits it): nav · hero (lane with ducks, "1 block = 1 step") · How it works (Scan, Hatch, Race; pinned) · The chain is the race clock (block strip) · For hosts (projector mock, Create a room) · Garage (parts: Layangan Wings, Turbo Tail, Iron Bill with slot + stats, 1 USDC) · No betting / contracts table (from config) · Photo-finish CTA · footer.

### 3.2 Responsive `/play`
- Breakpoint 1024 px. Above it: CSS grid `240px | 1fr | 400px`, header full width.
- `BottomNav` renders as a vertical sidebar; same items and handlers.
- Right panel content per screen: race → duck card, rank, top 5, CHEER; home/lobby → room info + wallet; garage/myduck → part detail. Screens that have no right-panel content use 2 columns.
- Sheets (`SignSheet`, `WalletSheet`) become centred dialogs ≥ 1024 px.

### 3.3 MotoGP grid (stage + phone)
- Slot position from index `i`: `row = floor(i/3)`, `col = i % 3`; x steps back per row, y per column, plus a diagonal stagger per column (see sample math in `renderVals()` of the design file).
- Flyover: a single transform on the grid layer, driven by the countdown seconds already on the stage (`countdown` from `race:countdown`). With ≤ 24 entrants no flyover; just show the grid.
- 200-slot performance: the existing stage draws ducks on canvas because 200 SVG nodes dropped to ~40 fps (comment in `ui.tsx`). The grid must also use the canvas sprites (`spriteOf`) or ≤ 24 visible DOM ducks plus canvas for the rest. Measure with `__tests__/stage/perf.mjs`.

## 4. Impacted Files

| Path | Change |
|---|---|
| `frontend/app/play/create/page.tsx` | [NEW] route `/play/create`: renders `PlayPage` starting on `create` (Reuse check: `app/play/page.tsx` read; same component, only the first screen differs). |
| `frontend/components/stage/sprites.ts` | [NEW] `spriteOf` moved out of `app/stage/[code]/ui.tsx` so `MotoGrid` can share it. |
| `frontend/app/page.tsx` | MODIFY: render landing instead of `redirect('/play')` |
| `frontend/components/landing/*` | [NEW] Hero, HowItWorks, BlockClock, Hosts, Garage, Contracts, FinalCta. Reuse check: no marketing components exist; reuse `components/ui/kit.tsx` buttons/pills and `DuckSvg`. |
| `frontend/lib/useScrollStory.ts` | [NEW] GSAP setup + reduced-motion guard (client only, dynamic import) |
| `frontend/package.json` | MODIFY: add `gsap` (UNVERIFIED U1) |
| `frontend/app/play/ui.tsx` | MODIFY: container responsive, 2/3-column grid ≥ 1024 px |
| `frontend/components/play/Shell.tsx` | MODIFY: `BottomNav` sidebar variant, sheets as dialogs on wide screens |
| `frontend/components/play/RaceScreens.tsx` | MODIFY: right panel (rank, top 5, CHEER) on wide screens; grid slot screen on phone during countdown |
| `frontend/app/stage/[code]/ui.tsx` | MODIFY: replace the 20-column STARTING GRID block with the MotoGP grid + flyover + minimap |
| `frontend/app/layout.tsx` | MODIFY: metadata for the landing (title/description/OG) |

## 5. Code Shape

```ts
// components/landing/useScrollStory.ts
export function useScrollStory(root: RefObject<HTMLElement>): void   // registers ScrollTrigger timelines; no-op when reduced motion
// components/stage/MotoGrid.tsx (new, used by stage ui.tsx)
export function MotoGrid(p: { entrants: GridEntrant[]; countdown: number; dense: boolean }): JSX.Element
export function slotOf(i: number): { row: number; col: number; x: number; y: number }   // pure, unit-tested
// components/play/GridSlot.tsx (phone countdown)
export function GridSlot(p: { entrants: GridEntrant[]; myIndex: number; countdown: number }): JSX.Element
```
Call flow unchanged: stage/phone already receive `race:grid` and `race:countdown`.

**UNVERIFIED:**
- ~~U1 GSAP licence~~ RESOLVED v1.1: Standard "No Charge" licence, commercial use and all plugins free; only no-code animation builders competing with Webflow are prohibited.
- U2 Next.js 16 client-component / dynamic import rules for GSAP → read `node_modules/next/dist/docs/` (required by `AGENTS.md`).
- U3 Stage fps with the grid at 200 entrants → `__tests__/stage/perf.mjs`.

## 6. UI/UX Changes (Lo-Fi)

See `docs/design/v2/` files listed in DoD. Do not invent sections; do not add decorative motion to `/play` or `/stage` beyond the grid flyover (DESIGN_SYSTEM §6).

## 7. Flowchart

```mermaid
flowchart LR
  L[/ landing/] -->|Play now| P[/play]
  L -->|Host a room| H[/play host flow]
  Q[QR /join/CODE] --> P
  P -->|≥1024px| W[2-3 column layout]
  P -->|<1024px| M[phone layout]
  S[/stage countdown] --> G[MotoGP grid + flyover] --> R[race]
```

## 8. Verification Plan

1. Visual check of every screen against its `.dc.html` at 390, 768, 1024, 1440 px (Playwright screenshots in `frontend/__tests__/`).
2. `slotOf` unit test: rows of 3, pole = index 0 at the front, deterministic.
3. Stage perf script at 200 entrants: ≥ 55 fps during countdown (U3).
4. Reduced motion: landing renders all sections with no ScrollTrigger pins.
5. Copy lint: grep build output for banned words (DoD 9).

## 9. Open Questions

| # | Question |
|---|---|
| Q1 | CLOSED: "Host a room" → `/play/create`; "Play now" → `/play` unchanged. |
| Q2 | CLOSED: Space = CHEER on laptop (≥1024px, race screen) only; mobile taps. |
| Q3 | CLOSED: contracts table shown now, addresses read from `lib/config.ts`. |
| Q5 | CLOSED: `.mjs` scripts + Playwright screenshots only. |
