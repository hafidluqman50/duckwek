# DuckWek smart contracts (Foundry)

Fixed, immutable contracts for the Blitz build. No proxy.

| Contract | Role |
|---|---|
| `DuckWekVault` | Every USDC payment (create room, join ticket, buy part) via an EIP-712 order + EIP-2612 permit, splits, room registry, pull payouts, gasless withdraw |
| `DuckWekRace` | Room lifecycle, seed and `startBlock`, one `Tick` per block, finalize with the standing root and podium, badge mint |
| `DuckNFT` | One duck per wallet, hatched by the operator after the first paid race, 5% ERC-2981 royalty |
| `PartNFT` | Part types plus license NFTs (platform parts now, creator parts later), 5% ERC-2981 royalty |
| `TrackNFT` | Tracks with rent price (platform track credits the protocol; creator track splits 50/50) |
| `Badge` | Soulbound podium titles, minted by the Race |
| `MockUSDC` | Testnet USDC (6 decimals, EIP-2612 permit) with a one-time 5 USDC welcome mint |

`Settlement` and `USDCFaucet` are not part of this build. The Race records the standing root and mints the Badge; the Vault's welcome mint replaces the faucet.

```bash
forge test        # 60 tests
forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast
./script/export-abi.sh
```

Deploy environment: `PRIVATE_KEY`, `OPERATOR`, `TREASURY`, `WELCOME_ENABLED`. See `.env.example`. Set `WELCOME_ENABLED=true` on testnet and `false` on mainnet.

Mainnet uses the real USDC and always disables the welcome mint. The script checks that the token has code, 6 decimals, the symbol `USDC`, and EIP-2612 `DOMAIN_SEPARATOR`/`nonces` before deploying:

```bash
USDC=<canonical USDC address> PRIVATE_KEY=... OPERATOR=0x... TREASURY=0x... \
  forge script script/DeployMainnet.s.sol --rpc-url "$RPC_URL" --broadcast
```

The Vault trusts the address it is constructed with. The canonical address must come from the official Monad docs and be checked on the explorer; the script proves the token shape, not the issuer.

Dependencies are vendored in `lib/`: forge-std v1.9.4 and OpenZeppelin v5.1.0. solc is pinned to `0.8.26`.

If `binaries.soliditylang.org` is blocked, point Foundry at a local solc: `FOUNDRY_SOLC=/path/to/solc-0.8.26 forge test --offline`.
