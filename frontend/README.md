# DuckWek web

Next.js 16 + Tailwind 4 + RainbowKit/wagmi + Socket.io.

- `/play` — phone app: Connect (wallet or Face ID passkey) → 0.10 USDC ticket → meet your duck → lobby → race → result. Bottom nav: Home / My Duck / Garage.
- `/stage/[code]` — projector (1920×1080, scales to the screen): QR, live track, photo finish, ABSOLUTE MARVELOUS. Click once to enable sound.
- `/join/[code]` — QR target.

Sound is synthesized with WebAudio (`lib/sound.ts`): no audio files. The passkey wallet (`lib/passkey.ts`) derives a key from the WebAuthn PRF extension; browsers without PRF fall back to a device wallet stored in that browser.

```bash
cp .env.example .env.local
npm install
npm run dev
```
