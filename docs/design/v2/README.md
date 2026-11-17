# DuckWek v2 — Design Source

Exported from the owner's Design canvas "DuckWek Mainnet Launch" (claude.ai, 2026-11-16). These files are the **approved visual spec** for plans `0013`, `0014`, `0015`. Tokens and rules still come from `docs/design/DESIGN_SYSTEM.md`; where a file and the design system disagree, the design system wins and the file is wrong.

## How to read a `.dc.html` file

Each file is one artboard in the canvas "Design Component" format, not production code:
- Markup between `<x-dc>` and `</x-dc>` is the screen. Inline `style` is the exact look (sizes, colours, borders, shadows).
- `{{name}}` holes are filled by `renderVals()` in the `<script type="text/x-dc">` block at the bottom; that block also holds the sample data (part names, stats, SVG polygons, track paths).
- `<sc-for list=… as=…>` = repeat, `<sc-if value=…>` = conditional.
- `@keyframes` in `<helmet><style>` are the intended motions.
- `[BRACKETS]` are placeholders for live data; never ship them.
- The files do not run standalone (`support.js` is the canvas runtime). Rebuild them as React + Tailwind per `AGENTS.md` §2.2.

## Index

| File | Screen | Size | Plan |
|---|---|---|---|
| `landing-desktop.dc.html` | Landing `/` (page, fluid) | 1440 wide | 0014 |
| `landing-phone.dc.html` | Landing `/` at phone width | 390 | 0014 |
| `play-laptop-race.dc.html` | `/play` ≥1024px, 2 columns, live race | 1440×900 | 0014 |
| `play-phone-grid.dc.html` | `/play` phone during countdown: your grid slot | 390×844 | 0014 |
| `stage-motogp-grid.dc.html` | `/stage/[code]` starting grid, MotoGP style | 1920×1080 | 0014 |
| `market-parts-laptop.dc.html` | Market › Parts (laptop) | 1440×900 | 0015 |
| `market-circuits-laptop.dc.html` | Market › Circuits for rent (laptop) | 1440×900 | 0015 |
| `market-parts-phone.dc.html` | Market › Parts (phone) | 390×844 | 0015 |
| `market-circuits-phone.dc.html` | Market › Circuits (phone) | 390×844 | 0015 |
| `creator-submit-phone.dc.html` | Sell your part: submit for review (interactive) | 390×844 | 0015 |
| `market-resale-laptop-q4.dc.html` | Market › Resale (Q4, show as disabled tab only) | 1440×900 | 0015 (Q4) |
| `nft-part.dc.html` | Part license NFT art | 800×800 | 0013 renderer |
| `nft-circuit.dc.html` | Circuit NFT art (duck laps the layout) | 800×800 | 0013 renderer |
| `nft-title.dc.html` | Soulbound title NFT art | 800×800 | 0013 renderer |
| `nft-part-slots.dc.html` | Slot frame colours (Wings / Tail / Bill), no rarity | 1680×620 | 0013 renderer, 0015 |

## Motion notes (from the canvas sticky notes)

**Landing (GSAP + ScrollTrigger, loaded on `/` only):**
- Hero: ducks run in place on the lane (CSS loop). Pointer: the nearest duck turns and hops (GSAP `quickTo`, one tween per duck). Block counter ticks as decoration, labelled demo.
- How it works: section pins for ~3 screens of scroll; scroll scrubs Scan → Hatch → Race; the egg cracks at step 2, the duck runs at step 3; each step moves the duck one "block".
- One block = one step: blocks slide in from the right while scrolling; each block pushes the ducks one step (scrub).
- Garage cards tilt toward the pointer (3°) and lift on hover. Final CTA: photo-finish flash + slow-mo on first view.
- `prefers-reduced-motion`: everything static, all content visible.

**`/play` laptop (≥1024px):** bottom nav becomes the left sidebar; centre = current screen at full size; right = duck, rank, top 5, CHEER. Below 1024px the phone layout is unchanged.

**MotoGP grid (visual only):** rows of 3, staggered, painted slot boxes with position numbers, pole next to the start line. Order = join order (`e.i`), unchanged. Countdown: camera flies from pole to the last row and back to pole for 3-2-1. Minimap under the track shows the whole field and the camera window. Engine, replay and contracts unchanged.

**NFT art:** built only from on-chain traits; `image` = static frame, `animation_url` = animated SVG (CSS/SMIL, no JS, loops ≤ 3 s).

## Content rules fixed in review (2026-11-16)

- No rarity anywhere. Parts show slot + stats (+ "best on" from fit data).
- Names: **Layangan Wings** (was Buroq Wings), **Merapi Ring** (original segment layout; was Alpine Ring / Red Bull Ring likeness). Kali Code Sprint, Turbo Tail, Iron Bill unchanged.
- No Duck NFT. "Hatch" is an animation only.
- Never "bet", "stake", "jackpot", "prize pool", "rare", "epic".
