# DuckWek Design System

Source of truth for the visual layer. This document records the approved tokens and rules that must not drift. All UI copy is English.

## 1. Principles

- One action per screen. No long forms.
- Thumb-first: primary actions at the bottom, target height at least 56 px.
- Feedback under 400 ms; the interface reacts before the chain confirms.
- No wallet popup after onboarding.
- The room is loud and the signal may be bad: no microphone, socket reconnect, state from the server.
- The phone and the projector show the same tick. The client never simulates the race.

## 2. Colour

| Token | Value | Use |
|---|---|---|
| `bg` | `#120B2E` | App and stage background |
| `surface` | `#1E1446` | Cards, panels, dock |
| `primary` | `#836EF9` | Monad purple, focus, progress |
| `accent` | `#FFC93C` | Duck yellow, primary CTA, invite code |
| `text` | `#FFFFFF` | Primary text |
| `muted` | `#C9B8FF` | Secondary text, stats, addresses |
| `outline` | `#000000` | Sticker outlines and drop shadows |
| `danger` | `#F25F5C` | Errors and destructive states |

## 3. Typography

| Role | Family | Notes |
|---|---|---|
| Display | `Lilita One` | Names, titles, ranks, big numbers |
| Body | `Rubik` | Weights 500, 700, 800, 900 |
| Mono | `JetBrains Mono` | Addresses, room codes, stats |

Display text uses a heavy black stroke (`-webkit-text-stroke`) with `paint-order: stroke fill`, matching the approved sticker look.

## 4. Shape and depth

- Heavy black outlines, rounded pills, offset hard shadows.
- Primary CTA: yellow fill, black outline, black text.
- Secondary surfaces: `surface` with a `primary` border or glow.
- No soft corporate gradients; the reference is a printed sticker, not glassmorphism.

## 5. Layout

| Surface | Size | Rules |
|---|---|---|
| Phone | 390 × 844 reference | No horizontal scroll; bottom dock reserved for the primary action |
| Stage | 1920 × 1080 | QR, track, top three and standings must survive a 100-duck pack |

The CHEER dock is fixed to the bottom safe area and never overlaps the track, the back action, or the result panel.

## 6. Motion

- Tap feedback is immediate (press state plus haptic where available).
- Race motion comes from the tick stream, with a three-step playback buffer on the stage (`LAG_STEPS = 3`).
- Photo finish uses a short slow-motion; the result is already decided by the server.
- Do not add decorative motion that competes with the race or the CHEER dock.

## 7. Components

- `PrimaryButton`: yellow, full width, 56 px minimum height.
- `Pill`: invite code, rank, rarity, balance.
- `StatBlock`: mono, compact, right aligned.
- `DuckCard`: portrait, name, template tag, stats.
- `PartCard`: name, rarity, effect, price, owned state.
- `CheerDock`: fixed bottom, non-overlapping, rate-limited.
- `QRPanel`: stage only; large enough to scan from the back of the room.
- `Toast`: errors from wallet or contract simulation, shown before any popup.

## 8. Copy rules

- Short, English, present tense.
- Never promise a prize pool, a payout, or a chance to win money.
- Say "ticket", "rent", "license", "title"; never "bet", "stake", "jackpot".
- Error copy states what happened and the next action, without exposing keys or signatures.
