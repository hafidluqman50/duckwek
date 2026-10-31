# DuckWek — Motion Pitch

A 10-scene, 16:9 motion deck for the DuckWek pitch. One self-contained HTML file: fonts, logo, app screenshot, and QR are embedded. No network needed.

**Open:** `open docs/pitch/duckwek-motion-deck.html` (Chrome recommended), then press `F` for fullscreen.

## One-liner

**For event hosts and their crowd watching the race on the big screen, DuckWek lets every phone join with one signature — the next 300 ms block moves every duck, so the room races, not watches.**

Formula: **For [who] who [moment], DuckWek lets them [one action] in [time] — so [why it’s fun].**

## Run of show

The deck is five beats, cut into ten motion scenes. The **problem story is ~70 seconds**; the rest moves fast. Hold any scene with the arrow keys; the `A` autoplay is only a 9-second preview, not the real pitch.

| Beat | Scenes | What the room hears |
|---|---|---|
| Hook | 1 Cover | The biggest race in town. You’re not in it. |
| Problem → Solution | 2–3 | You pay, but you don’t play. The water decides. Your odds freeze at checkout. DuckWek makes the room the controller. |
| How + proof | 4–7 | One signature, one tick per block, one root to replay. Stats trade off; CHEER is a lever; Monad is the clock. |
| Business | 8 | Fees, not bets. The Vault float is the TVL. No emissions, no token. |
| Roadmap → Ask | 9–10 | Q4 2026 mainnet real USDC; Q1 2027 Creator Studio; Q2 2027 Marketplace; Q3 2027 tips, season pass, venue circuit; scan to play. |

## B-L-I-T-Z check

| Filter | Deck |
|---|---|
| **B** — demo in 2 minutes | The live demo is 60 seconds; the problem story is ~70. Don’t cut the story to hit 90. |
| **L** — latency visible | 300 ms on the cover and Why Monad; the tick strip moves one step per block. |
| **I** — one core feature | Scan → sign once → cheer. Stats and roadmap are depth, not the demo. |
| **T** — the audience plays | QR on the last scene; every phone is the controller. |
| **Z** — zero setup | One signature, gas sponsored, no MON. Not email/Google; DuckWek uses a passkey/wallet signature. |

## The spoken script

The same lines are built into the deck’s presenter notes — press `N`. The problem beat runs about seventy seconds; the rest is roughly ninety seconds. Start with the riverbank; don’t read the slide.

1. **Cover — 0:00.** You’ve seen a duck derby: a river, thousands of yellow ducks, a whole town screaming. It’s the biggest race in town. And you’re not in it.
2. **Problem — 0:08.** The condensed story is below. Start at the riverbank; end on “what if the room could race?”
3. **Solution — 1:20.** So we built the opposite. DuckWek makes the room the controller. Scan, sign once, and your duck is in the race. Every block moves every duck one step. You can CHEER to push yours.
4. **How it works — 1:32.** One signature. The Vault takes the ticket. The race fixes a seed and a start block on-chain. Every block, one tick moves every duck. The math runs off-chain; the root goes on-chain, so anyone can replay it.
5. **Stats — 1:44.** Now you have a choice. A heavy duck holds Kali. A fast duck owns Alpine. No part wins both. You’re picking a trade-off, not a skin.
6. **CHEER — 1:54.** You’re behind. You tap. Five taps a second, 20% cap. Your duck catches the leader — maybe. The race still has noise, splash, and a finish. The cheer log goes into the root.
7. **Why Monad — 2:04.** Why Monad? Because this race is a clock. 300ms blocks, 600ms finality, 10,000+ TPS, EVM. One tick per block. 48,264 gas, and the relayer pays. On a slower chain, the race would stutter.
8. **Business — 2:14.** The host opens a room for 1 USDC. You join for 0.10. A part costs 1. Tracks and tickets split 50/50; parts 85/15. No prize pool. The money in the Vault is the TVL. No emissions, no token.
9. **Roadmap — 2:26.** Q4 2026: mainnet with real USDC. Q1 2027: Creator Studio — publish parts with a 5% royalty. Q2 2027: the Marketplace — buy and resell with a 2.5% protocol fee. Q3 2027: tips, season passes, and a venue circuit.
10. **Ask — 2:38.** So: your duck is waiting. Scan, pay 0.10, and race the room. No bet. Only a ticket. The room doesn’t have to watch anymore.

## Problem narrative

Picture a riverbank on a Saturday. A charity has spent a year on this: a crane, a finish line, ten thousand numbered rubber ducks. A kid in a yellow raincoat holds ticket 412; her grandmother bought it. The horn goes off. The town screams. The water takes the ducks. The first one across the line isn’t 412. The charity gets a check. The kid gets a photo. By the afternoon, the bank is empty.

That’s a duck derby: a great fundraiser, a great spectacle, a bad race. **A:** you pay, but you don’t play. The duck is yours; the race isn’t. **B:** the water decides. The current picks the winner; your ticket can’t change the odds. **C:** your odds freeze at checkout. Once you pay, there’s no way to improve your chance. No boost, no comeback, no next block.

The organizer spends a year on one afternoon. The sponsor gets a banner. The kid gets a few minutes of joy, then nothing. Digital versions just add an animation; it’s still one player, one screen, one random draw.

The demand is there: 90,000 ducks in Chicago, 200,000 in Cincinnati, 205,000 in the record books. The room is already there. The format doesn’t let it play.

So we asked: what if the water wasn’t the only thing that could move a duck? What if the room could race?

*This is a composite scene from the real duck-derby format, not a claim about one specific event. The 90k / 200k / 205k figures are the real derby counts.*

## How it works in one breath

```
sign (EIP-2612) → Vault charges the ticket → start fixes seed + startBlock
→ one tick tx per block → off-chain step(template, parts, seed, n, cheer)
→ finalize writes standing root + podium
```

The chain holds the seed, the tick count, the standing root, and the podium. Positions, overtakes, and CHEER are computed off-chain and can be replayed from the seed, the participant list, and the cheer log. That keeps the race cheap and still verifiable.

## Why stats matter

Templates and parts trade **speed**, **weight**, and **boost**. The step is:

```
step = base + speed − weight + noise + catch-up + boost − splash
```

Noise keeps it a race; catch-up is bounded; splash is the track’s tax. Kali rewards grip, Alpine rewards speed. In the engine test, Iron Bill is strongest on Kali and Buroq Wings on Alpine. No part wins both.

## Why CHEER can win

Tapping adds energy. Boost is capped at **20% speed**, taps are rate-limited to **5/s**, and quiet steps decay energy. The taps land on the next computed step and are recorded in the cheer log. A tapper can overtake an idle duck with the same stats — but noise, splash, catch-up, and the finish still decide the race. It is an input, not a button.

## Roadmap — by quarter

| Quarter | Milestone |
|---|---|
| **Q4 2026** | Mainnet with real USDC; live race. |
| **Q1 2027** | Creator Studio: publish parts, 5% royalty. |
| **Q2 2027** | Marketplace: buy, resell, 2.5% protocol fee. |
| **Q3 2027** | Tips, season pass, venue circuit. |

The roadmap scene shows **Q4 2026 → Q3 2027** on one line, with the Creator Studio and Marketplace screens tied to Q1 2027 and Q2 2027.

## Roadmap UI (planned, not live)

The roadmap scene shows the actual proposed screens, labelled **PLANNED UI**:

- **Creator Studio (Q1 2027):** create a part, set speed/weight/boost, price it at 1 USDC, set a 5% royalty, publish.
- **Marketplace (Q2 2027):** buy a license for 1.00 USDC, resell for 1.50 USDC, creator keeps 5%, protocol takes 2.5%.

The point is for judges to see the resale loop, not just hear “marketplace”.

## Narrative research used

- **Start with a scene, then data.** The story gives the audience a hero and a moment; the numbers validate it. Harvard Innovation Labs: lead with the moment that made the problem real, then use data to reinforce.
- **Give the hero something to lose.** StoryFlint: emotional stakes are what the character fears losing; plot stakes alone don’t land.
- **Introduce → build up → problem → hold the resolution.** Mind the Product’s “Unfinished Story” framework: set the stage, show the cost, define the problem, then stop before the solution.
- **Answer the problem-slide questions.** Ellty: who has the problem, how big it is, why it matters now, what happens if it isn’t solved, and why existing solutions fail.
- **Use the real format.** Race A Duck: supporters adopt numbered ducks; on race day the ducks are released into a river; the first across the line wins; the crowd watches from the bank.

## Copy rules used

- One idea per scene; the headline should be repeatable.
- Start with a scene and a person; let the numbers arrive after the feeling.
- The spoken notes are a story: the room, the problem, the turn, the proof, the close. If a line sounds like a spec sheet, cut it.
- Concrete numbers over adjectives: 90k, 200k, 205k, 300 ms, 48,264 gas, 0.10, 1, 5%, 2.5%.
- Active voice. No “revolutionary”, “seamless”, “trustless”, “unlock”.
- Label future UI as planned. Never imply live features that are not.
- End on a URL and a QR, not a repository.

## Controls

| Key | Action |
|---|---|
| `→` / `space` | Next scene |
| `←` | Previous scene |
| `A` | Toggle 9-second autoplay |
| `N` | Toggle presenter notes |
| `F` | Fullscreen |
| `Home` / `End` | First / last scene |
| `?scene=4` | Open a specific scene |

The deck is 1920×1080 and scales to the window. It is intentionally keyboard-first so the speaker can hold a scene while answering judges.
