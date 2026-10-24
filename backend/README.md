# DuckWek API

Express + TypeScript, PostgreSQL via Sequelize, Socket.io. Structure follows `car-rental-react-express`: `routes/*/api.ts` → `app/Http/Controllers` → `Requests` (Joi) → `DTOs` → `Services` → `Repositories` → `Models`.

```bash
cp .env.example .env
npm install
npm run migrate:latest && npm run seed:run
npm run dev            # http://localhost:8080 · Swagger at /api-docs
npm run test:e2e       # full flow against a running API + chain
N=50 W=200 npm run test:load
```

Without contract addresses or keys the relayer runs in mock mode (no chain), and `BLOCK_SOURCE=timer` ticks every 300 ms without a node.
