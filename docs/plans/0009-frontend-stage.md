# Frontend Partial 2 — Projector Stage

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

The projector is the room. It shows the QR that brings players in, the grid that makes the room feel full, the race that everyone watches, the photo finish and the winner. It has one canvas, one screen and one job: keep the pack moving smoothly even when blocks arrive late.

This partial defines `/stage/[code]`: the phase machine, the QR, the 100-duck canvas, the three-step playback buffer and the performance budget. It consumes the same `race:tick` as the phone.

## 2. Definition of Done

1. `/stage` accepts a room code; `/stage/[code]` renders that room at 1920×1080.
2. The QR points to `/join/CODE` on the public app URL.
3. The phase machine moves `lobby -> countdown -> race -> photo -> result` from socket events.
4. The pack renders on one canvas; 100 ducks stay smooth at the venue.
5. The playback buffer is `LAG_STEPS = 3`; the pack does not stand still on a late block.
6. The photo finish and the winner reveal use the result payload; no local winner is invented.
7. The stage reconnects and restores the current state after a socket drop.
8. Headless screenshots and a frame trace are produced before the demo.

## 3. Feature Description

### 3.1 Routes

| Route | Purpose |
|---|---|
| `/stage` | Code entry form |
| `/stage/[code]` | Projector for one room; code uppercased |

### 3.2 Phase machine

| Phase | Trigger | What is shown |
|---|---|---|
| `idle` | `room:state` with no race | QR, room name, join count |
| `countdown` | `race:grid` / `race:countdown` | Grid, 3-2-1 |
| `race` | `race:go`, `race:tick` | Track, pack, top three, lap |
| `photo` | `race:result` | Photo finish, short slow-motion |
| `result` | after `photoMs` or `race:settled` | Winner title, podium, settle proof |

- `race:aborted` returns to `idle`.
- A reconnect calls `room:watch` and receives `room:state`, `race:grid` and a `race:tick` snapshot.

### 3.3 Stage layout

```text
1920 × 1080
┌──────────────────────────────────────────────────────────────┐
│  DUCKW EK · KALI CODE SPRINT           LAP 1/1 · 00:41        │
│                                                              │
│   [QR]   ████████████████████████████████████████████████    │
│          ████████████████████████████████████████████████    │
│          ████████████████████████████████████████████████    │
│                                                              │
│  P1  Duck A        P2  Duck B       P3  Duck C               │
└──────────────────────────────────────────────────────────────┘
```

- The QR is generated from `APP_URL + /join/CODE`; if `APP_URL` is empty, the QR is hidden and the code is shown large.
- The room name, code, track, lap and join count are always readable from the back of the room.
- The top three and the pack are the focus; the feed is secondary.

### 3.4 Canvas and playback

- One `<canvas>` for the race layer; React does not re-render a duck per tick.
- Sprites are pre-rendered per color into an offscreen canvas (`spriteOf`), so the frame loop draws images, not paths.
- `LAG_STEPS = 3`, `STEP_MS = 300`, `KEEP = 14`: the renderer keeps a short history and plays the pack about 0.9 s behind the chain.
- The buffer trades a small delay for smoothness; the phone stays live.
- Positions come from `tick.p`; the renderer interpolates between buffered steps.
- Energy comes from `tick.en`; the glow uses the same value as the phone.
- A late or repeated tick is ignored by step number; a jump fills the missing steps.

### 3.5 Sound

- Lobby music, race music, countdown beeps, splash on every other tick, winner sting.
- A sound toggle is visible; the stage defaults to on.
- Sound never blocks the socket or the render loop.

### 3.6 Performance budget

- Target: 100 ducks at the venue with no frame drop below the measured budget; the 200-slot maximum is not a participant count.
- Measure with a headless browser trace: FPS, p95 frame time, stand-still frames.
- If the budget fails, reduce sprite work or the number of decorative effects, not the tick source.

## 4. Impacted Files

| File | Status | Purpose |
|---|---|---|
| `frontend/app/stage/page.tsx` | `[NEW]` | Code entry |
| `frontend/app/stage/[code]/page.tsx` | `[NEW]` | Uppercases the code and renders `StagePage` |
| `frontend/app/stage/[code]/ui.tsx` | `[NEW]` | Phase machine, QR, canvas, photo, winner |
| `frontend/components/duck/DuckSvg.tsx` | `[NEW]` | Duck shape shared with the phone |
| `frontend/lib/track.ts` | `[NEW]` | Track geometry for the stage path |
| `frontend/lib/sound.ts` | `[NEW]` | Music and effects |
| `frontend/lib/useRoomLive.ts` | `[NEW]` | Socket state and phases |
| `frontend/__tests__/stage/{shots,perf,feed}.mjs` | `[NEW]` | Screenshots, frame trace, live feed |
| `frontend/app/globals.css` | `[NEW]` | Stage theme and fonts |

### Reuse check

| `[NEW]` item | Existing material read | Why it cannot serve as-is |
|---|---|---|
| Stage app | Nothing exists in this repository | New implementation; shares types with the phone |
| `useRoomLive` | The socket contract in `0007` | New hook; consumes the same events |
| `track.ts` | The track profile in the database seed | New geometry renderer for the stage |

## 5. Code Shape

```ts
const W = 1920, H = 1080
const LAG_STEPS = 3
const STEP_MS = 300
const KEEP = 14

function useFit(ref): number
function spriteOf(color: string): HTMLCanvasElement
function RaceLayer(props: {
  geo: TrackGeo
  ents: GridEntrant[]
  p: number[]
  n: number
  en: number[]
  big: boolean
  top3: { i: number; label: string }[]
}): JSX.Element

function StagePage({ code }: { code: string }): JSX.Element
```

- `StagePage` owns `qr`, `armed`, `photoGo` and uses `useRoomLive(code)`.
- `spriteOf` caches one canvas per color.
- `RaceLayer` runs the frame loop in `useEffect`; it reads refs, not React state per frame.
- `useFit` scales the 1920×1080 stage to the projector viewport.

## 6. UI/UX Changes (Lo-Fi)

```text
LOBBY
┌──────────────────────────────────────────────┐
│  DUCKW EK · WEK-7Q2          12 ducks joined │
│                                              │
│   [ QR ]      SCAN TO RACE                   │
│               KALI CODE SPRINT · 1 LAP       │
└──────────────────────────────────────────────┘

RACE
┌──────────────────────────────────────────────┐
│  LAP 1/1 · 00:41        P1 Duck A  P2 Duck B │
│   ████████████████████████████████████████   │
│   ████████████████████████████████████████   │
└──────────────────────────────────────────────┘
```

- The QR is large; the code is also shown as text for a phone that cannot scan.
- The winner reveal uses the result, not a local animation guess.
- The stage never shows a private key, a JWT or a raw signature.

## 7. Flowchart

```mermaid
flowchart TD
  A[/stage/CODE] --> B[room:watch]
  B --> C{phase}
  C -- idle --> D[QR + join count]
  C -- countdown --> E[grid + 3-2-1]
  C -- race --> F[canvas pack + ticks]
  F --> G[race:result]
  G --> H[photo finish]
  H --> I[winner + podium + settle]
  I --> D
```

## 8. Verification Plan

| # | Check | Method |
|---|---|---|
| T-1 | QR resolves to `/join/CODE` | Scan on a phone |
| T-2 | Phase machine from socket events | Live room |
| T-3 | 100 ducks render | Load room and capture FPS |
| T-4 | No stand-still on a late tick | Synthetic 1.2 s gap in the feed |
| T-5 | Photo finish and winner | Live race |
| T-6 | Reconnect restores state | Toggle network |
| T-7 | No private data on screen | Manual check |
| T-8 | Headless screenshots | `frontend/__tests__/stage/shots.mjs` |

### UNVERIFIED

| Claim | Why | Resolved by |
|---|---|---|
| 60 fps on the venue laptop | Hardware and projector dependent | On-site trace |
| QR scanning at the venue distance | Projector and camera dependent | Rehearsal |
| 100-duck sprite memory | Not measured here | Perf trace |

## 9. Open Decisions

| ID | Decision | Blocks | What the owner must provide |
|---|---|---|---|
| O-2 | Room capacity | this plan | Confirm 100 for the demo room |
| O-26 | Bot fill | this plan | Confirm bots are visual only |
| O-33 | Stage sound | this plan | On or off for the demo |
| O-34 | Playback lag | this plan | Keep 3 steps or trade more delay for smoothness |
| O-35 | Projector resolution | this plan | 1080p or another output |
