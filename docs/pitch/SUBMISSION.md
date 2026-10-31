# DuckWek — Submission Description

## Short description (for the form)

DuckWek is live duck racing for the whole room. A duck derby today is a raffle: you pay for a numbered duck, the water picks the winner, and nothing you do changes the outcome. DuckWek makes the room the controller. Scan the QR, sign once, and your duck joins the race. Every Monad block (~300 ms) moves every duck one step; templates and parts change speed, weight, and boost; CHEER lets players push their duck. The seed, tick count, and final standing root are on-chain, so the race can be replayed; positions run off-chain so it stays cheap. Tickets are 0.10 USDC; the relayer pays gas; players never hold MON. No betting, no prize pool, no token. One duck per wallet, soulbound podium badges, USDC fees only. Live on Monad testnet; mainnet with real USDC targeted Q4 2026.

---

## One-liner

For event hosts and their crowd watching the race on the big screen, DuckWek lets every phone join with one signature — the next 300 ms block moves every duck, so the room races, not watches.

## The problem

A duck derby is a real, beloved fundraiser. Thousands of numbered rubber ducks go into a river; supporters adopt a duck for a few dollars; the first duck across the line wins; a crowd watches from the bank. It works as a fundraiser and as a spectacle, but not as a race.

You pay for a duck, but you don't play. The duck is yours; the race isn't. There is no skill, no choice, no lever. The water decides: the current picks the winner, and your ticket can't change the odds. Once you've paid, your chance is frozen at checkout. There is no boost, no comeback, no next block.

Digital versions add an animation, not agency. They are still one player, one screen, one random draw. The host still stitches together registration, payments, and a leaderboard. The format is still a raffle.

The demand is already there. Chicago fills 90,000 ducks. Cincinnati fills 200,000. The record is 205,000. The room is already in front of the screen. The format doesn't let it play.

## The solution

DuckWek turns the derby into a room-wide race. The phone becomes the controller. Scan the QR, sign once, and your duck joins the room. Every Monad block moves every duck one step. Stats and parts change how your duck moves; CHEER lets you push it. The room is no longer watching a draw; it is racing.

The point is not to replace the derby's charm. It is to keep the crowd, the noise, and the shared screen — and give the room an input. The same town, the same riverbank, the same yellow ducks: now the phones are part of the race.

## How it works

1. **Room.** The host opens a room with a 1 USDC rent and picks a track.
2. **Join.** The player signs one EIP-2612 permit. The relayer submits it; the Vault charges the 0.10 USDC ticket. Gas is sponsored; the player pays no MON. One duck per wallet.
3. **Start.** The race fixes `startBlock` and a seed from `prevrandao`, the room key, and the participant count. The participant root is recorded.
4. **Tick.** One transaction per block calls `tick(roomId)`; `n = block.number - startBlock`. The off-chain engine computes positions from the seed, templates, parts, the track, and the frozen CHEER log. The phone and the stage receive the same tick.
5. **Finalize.** The standing root, the podium, and first-time podium badges go on-chain. The duck hatches after the first paid race.

The chain holds the seed, the tick count, the standing root, the podium, and the badges. Positions, overtakes, and CHEER run off-chain so the race stays cheap; anyone can replay them from public data.

## The race

- **Templates.** Balanced, Sprint, and Tank trade speed, weight, and boost.
- **Parts.** Buroq Wings (+2 speed, 0 weight, −1 boost), Turbo Tail (+1 speed, +1 weight, 0 boost), Iron Bill (−1 speed, +1 weight, +2 boost).
- **Step.** `step = base + speed − weight + noise + catch-up + boost − splash`. Noise keeps it a race; catch-up is bounded; splash is the track's tax. Kali rewards grip; Alpine rewards speed. No part wins both.
- **CHEER.** Taps are rate-limited to 5/s, capped at 20% speed, and energy decays on quiet steps. Taps land on the next computed step and are recorded in the cheer log. A tapper can catch an idle duck, but the race still decides. CHEER is an input, not a button.
- **Titles.** Podium badges are separate soulbound ERC-721 tokens (ERC-5192), awarded to a wallet for a first-time rank. They cannot be transferred or sold. The Duck NFT is one per wallet, with a 5% ERC-2981 royalty.

## Why Monad

The race needs a clock, not a slideshow. Monad gives us 300 ms blocks, 600 ms finality, 10,000+ TPS, and the EVM. One block is one tick; one tick moves every duck. A tick costs 48,264 gas; the relayer pays, so players never hold MON. Every phone and the stage see the same block.

This is a real-time, many-small-transactions, multiplayer product. On a slower chain, the race would stutter. On Monad, the chain can be the clock.

## Product and users

- **Event hosts, venues, charities.** They open a room, pick a track, and give the crowd a game instead of a raffle.
- **Players.** They join from a phone with one signature, choose a duck and parts, and CHEER during the race. No MON; gas is sponsored.
- **The stage.** The shared screen shows the race, the standings, and the podium. The phone is the controller; the stage is the room.
- **The duck.** One per wallet. It hatches after the first paid race; parts and titles live with the wallet.

## Business model

- **Room rent:** 1 USDC to open a room; 50/50 split.
- **Ticket:** 0.10 USDC to join; 50/50 split.
- **Part license:** 1 USDC; 85/15 creator/protocol.

There is no betting and no prize pool. Podium titles are soulbound — won, never bought. The Vault holds player balances, creator earnings, and protocol fees; that USDC float is the TVL. Payouts are pull-based: everyone withdraws their own. No emissions, no token, no yield.

Per room: `rent + 0.10 × tickets + 1 × parts`.

## Roadmap

| Quarter | Milestone |
|---|---|
| **Q4 2026** | Mainnet with real USDC; live race. |
| **Q1 2027** | Creator Studio: publish parts, 5% royalty. |
| **Q2 2027** | Marketplace: buy, resell, 2.5% protocol fee. |
| **Q3 2027** | Tips, season pass, venue circuit. |

## Tech stack and contracts

- **Contracts:** Solidity 0.8.26, Foundry, OpenZeppelin v5.1.0. Immutable contracts, no proxy. `DuckWekRace` (rooms, seed, ticks, finalize), `DuckWekVault` (USDC orders, permits, splits, pull payouts), `DuckNFT` (one duck per wallet, 5% ERC-2981), `TrackNFT`, `PartNFT`, `Badge` (soulbound ERC-5192). Mock USDC on testnet; real USDC on mainnet.
- **Backend:** Express, TypeScript, Sequelize, PostgreSQL, Socket.io, viem. The relayer submits transactions; the race engine runs off-chain; Supabase for the database; Fly.io for the API.
- **Frontend:** Next.js 16, Tailwind 4, wagmi/RainbowKit. Vercel for the app; the phone and the stage are the same product.
- **Monad:** 300 ms blocks, 600 ms finality, 10,000+ TPS, EVM; one tick per block; 48,264 gas per tick; gas sponsored by the relayer.

## Status and links

- **Live app:** https://duckwek-app.vercel.app
- **GitHub:** https://github.com/hafidluqman50/duckwek
- **Status:** live on Monad testnet; contracts verified; mainnet with real USDC targeted Q4 2026.
- **No token. No betting. No prize pool.**
