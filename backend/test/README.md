# Backend tests

All commands run from `backend/`. Offline tests need no network, database or chain. The e2e and load tests talk to a real
deployment and spend test funds.

## Offline (engine)

- `npx ts-node -T -r tsconfig-paths/register test/engine/cheer.test.ts` — cheer log and engine.
- `npx ts-node -T -r tsconfig-paths/register test/engine/fairness.test.ts` — identical stats, one winner.
- `MODE=baseline|tuned RACES=200 npx ts-node -T -r tsconfig-paths/register test/engine/montecarlo.script.ts` — win shares
  per template and part. Other env vars: `FIELD`, `TUNE`, `CHEER_TUNE`, `CHEER`, `QUIET`, `CALIBRATE`.
- `FIELD=50 RACES=400 CHEER_TUNE='{"cheerMax":50000}' npx ts-node -T -r tsconfig-paths/register test/engine/rank.script.ts`
  — average finishing place of a tapper and an idler. Other env vars: `TAP_FROM`, `TAPS`.
- `npm run test:balance` points at `test/engine/search.script.ts`, which is not in the repo.

## Session limit and duration (offline)

- `npx ts-node -T -r tsconfig-paths/register test/session/limit.test.ts` — bounds and defaults of the sign-in limit and duration.

## ABI drift (offline)

- `npx ts-node -T -r tsconfig-paths/register test/e2e/abi.check.ts`

## Real deployment (e2e)

- `API_URL=http://localhost:8080 RPC_URL=<rpc> npx ts-node -T -r tsconfig-paths/register test/e2e/flow.e2e.ts`
  (also `npm run test:e2e`). Optional: `OPERATOR_ADDRESS`.
- `API_URL=… RPC_URL=… npx ts-node -T -r tsconfig-paths/register test/e2e/cheer.e2e.ts`
- `API_URL=… npx ts-node -T -r tsconfig-paths/register test/e2e/cadence.e2e.ts`. Optional: `LAG`, `EXTRAP`, `TRACK`,
  `TRACE_OUT`, `TRACE_IN`.
- `VAULT=0x… MOCK_USDC=0x… API_URL=… RPC_URL=… npx ts-node -T -r tsconfig-paths/register test/e2e/limit.e2e.ts` — sign-in limit and duration on a real deployment: bounds, permit values, raise and lower replace the session (new wallet, spends about 4 USDC of the welcome balance).
- `CREATOR_KEY=0x… TRACK_ID=3 VAULT=0x… MOCK_USDC=0x… API_URL=… RPC_URL=… npx ts-node -T -r tsconfig-paths/register test/e2e/withdraw.e2e.ts`
- `DOTENV_CONFIG_PATH=.env.staging npx ts-node -T -r tsconfig-paths/register test/e2e/catalog.sync.ts` reads the catalog
  from the chain into the database the env points at.

## Load test

- `API_URL=http://localhost:8080 RPC_URL=<rpc> N=200 W=200 npx ts-node -T -r tsconfig-paths/register test/load/loadtest.ts`
  (also `npm run test:load`). Optional: `TRACK`, `CONCURRENCY`.
