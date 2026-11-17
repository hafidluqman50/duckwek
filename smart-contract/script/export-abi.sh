#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p ../frontend/lib/abi ../backend/test/e2e/abi
for c in MockUSDC TrackNFT PartNFT Badge DuckWekVault DuckWekRace; do
  f=$(find out -name "$c.json" -path "*/$c.sol/*" | head -1)
  node -e "const j=require('./$f'); process.stdout.write('export const ${c}Abi = '+JSON.stringify(j.abi)+' as const\n')" > ../frontend/lib/abi/$c.ts
  node -e "const j=require('./$f'); process.stdout.write(JSON.stringify(j.abi,null,2))" > ../backend/test/e2e/abi/$c.json
done
echo "ABIs exported"
