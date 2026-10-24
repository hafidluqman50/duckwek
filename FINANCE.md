# DuckWek — FINANCE

> The fixed contracts are the source of truth. This document mirrors them. If a number here disagrees with a contract constant, the contract wins and this document is wrong.

---

## 1. Assets

| Asset | Network | Function |
|---|---|---|
| **Mock USDC** (ERC-20, 6 decimals, EIP-2612) | testnet | every price and payment; one-time 5 USDC welcome mint per wallet through the Vault |
| **USDC** | mainnet | same role; the welcome mint is disabled |
| **MON** | gas only | paid by the relayer; players never hold MON |

---

## 2. Contracts

| Contract | Function |
|---|---|
| `MockUSDC` | token plus the welcome mint (testnet only) |
| `DuckWekVault` | balances, orders, splits, room registry, pull payout |
| `PartNFT` | part license (ERC-721, 5% ERC-2981 royalty) |
| `TrackNFT` | track ownership and rent |
| `DuckNFT` | duck (ERC-721, 5% ERC-2981 royalty) |
| `Badge` | soulbound title, minted by `DuckWekRace` |
| `DuckWekRace` | room lifecycle, seed, tick, finalize, badge mint |
| Treasury | protocol fee receiver; owner of platform tracks and parts |

`Settlement` and `USDCFaucet` are not part of the fixed deployment. The Race records the standing root and mints the Badge; the Vault's welcome mint replaces the faucet.

---

## 3. Flows and splits (fixed)

| # | Flow | Payer | Receiver | Split |
|---|---|---|---|---|
| 1 | **Create room / track rent** | host | track creator / protocol | **50 / 50** · platform track = **100% protocol** |
| 2 | **Join room / ticket** | player | circuit owner / protocol | **50 / 50** · platform track = **100% protocol** |
| 3 | **Part — primary** | player | part creator / protocol | **85 / 15** · platform part = **100% protocol** |
| 4 | Part — secondary (roadmap) | buyer | creator / protocol | 5% royalty + 2.5% fee |
| 5 | Tip (roadmap) | viewer | player / protocol | 90 / 10 |
| 6 | Duck royalty | collector | builder | 5% (ERC-2981) |
| 7 | Badge | — | — | free, soulbound, cannot be bought |
| 8 | Season pass (roadmap) | player | protocol | 100% |

**Final prices for the build:**

- Create room (track rent): **1 USDC**
- Join room (ticket): **0.10 USDC**
- Part: **1 USDC**

Platform tracks and parts are owned by the treasury, so the same single split rule credits the protocol alone. Creator tracks and creator parts use the same constants: 50/50 on rent and ticket, 85/15 on the primary part sale.

---

## 4. Scope

### Build (must ship)

- [ ] Mock USDC plus the one-time welcome mint
- [ ] Vault ledger, permit, `permitAndSpend`, `spend`, `spendBatch`
- [ ] Create room (1 USDC)
- [ ] Join room (0.10 USDC)
- [ ] Buy one part (1 USDC) as a license
- [ ] Soulbound badge for the podium
- [ ] Withdraw, including gasless withdraw
- [ ] Gas sponsored by the relayer

### Roadmap

- Tip 90/10
- Creator tracks and parts
- Secondary market and royalties
- Season pass
- Race sponsor
- Partner perks (B2B)

---

## 5. Unit economics

These are assumptions, not contract constants. The contract fixes the split, not the number of part sales.

Assumption: 100 participants in one race; 20% buy one part (20 licenses at 1 USDC).

| Source | Platform part | Creator part |
|---|---|---|
| Track rent (platform track, 100% protocol) | 1.00 USDC | 1.00 USDC |
| Part primary: protocol share | 20.00 USDC | 3.00 USDC |
| Part primary: creator share | — | 17.00 USDC |
| Tip | excluded (roadmap) | excluded (roadmap) |
| **Protocol total** | **21.00 USDC** | **4.00 USDC** |

Gas and server cost are excluded here; they are measured in `0010`. There is no monthly extrapolation until a real race is measured.

`200` is the maximum slot count, never a participant count. The unit table uses the 100 people in the venue.

---

## 6. Hard rules

1. **No betting.** No stake is put at risk.
2. **No cash-out of a bet.** Money leaves only from a Vault balance earned by selling, tipping or royalties.
3. **A badge cannot be bought** (soulbound).
4. **A part has a trade-off**; no part wins on every track.
5. **No prize pool** from participant money.
6. **Every receiver pulls** their own balance; the protocol does not push.

---

## 7. Keys and treasury

| Key | Can | Cannot |
|---|---|---|
| **Owner (multisig, timelock on mainnet)** | set operator, set treasury, set prices, enable/disable welcome, pause | move a player's balance |
| **Operator / relayer** | `permitAndSpend`, `spend`, `withdrawWithSig`, race lifecycle | withdraw for itself, change prices, redirect a withdrawal |
| **Treasury (separate multisig)** | receive protocol fees | sign transactions over the Vault |

The relayer is funded with MON and monitored. In the fixed design there is no result-signer key, because `Settlement` is not deployed.

---

## 8. Roadmap by phase

| Phase | Revenue | Status |
|---|---|---|
| **0 — Hackathon** | room rent + part licenses | build |
| **1 — Venue** | + tip + creator track rent | 1–2 months |
| **2 — Creator** | + creator parts, secondary market, royalties | 3–6 months |
| **3 — Mainnet** | + sponsor race + season pass + partner perks | 6–12 months |
| **4 — Circuit** | + city league licensing | 12 months+ |

### Metrics kept

- races per day
- unique wallets
- USDC volume
- number of tracks and parts
- season retention
- part purchase rate

---

## 9. Pitch line

> *"We don't take a bet — we take a fee. Every race pays the track creator and the part seller. Contracts verified, keys split, and the only thing at risk is gas."*
