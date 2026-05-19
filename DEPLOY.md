# Deploy Pensieve on Vercel (GitHub)

Push to `main` → Vercel builds and deploys automatically once the repo is linked.

## 1. Link GitHub on Vercel

1. [vercel.com/new](https://vercel.com/new) → Import `Pensieve` repo
2. **Root Directory**: `.` (repo root)
3. Framework Preset: **Other** (uses `vercel.json`; API entry is `api/index.ts`)
4. Deploy once (will fail until env + DB are set)

## 2. Add Postgres (Neon)

1. Project → **Storage** → **Create Database** → **Neon Postgres**
2. Connect to **Production** (and Preview if you want)
3. Vercel injects `POSTGRES_URL` automatically

## 3. Environment variables

In Vercel → **Settings** → **Environment Variables**:

| Variable | Required | Notes |
|----------|----------|--------|
| `ANTHROPIC_API_KEY` | Yes | [Anthropic console](https://console.anthropic.com/) |
| `POSTGRES_URL` | Yes | Auto-set if Neon is linked |
| `FRONTEND_URL` | Optional | Production URL, e.g. `https://pensieve.vercel.app` |

## 4. Redeploy

**Deployments** → latest → **Redeploy** (or push an empty commit).

Build runs: backend compile → DB migrate → frontend build → copy to `public/`.

## 5. Verify

- `https://<your-domain>/api/health` → `{"ok":true}`
- Open the app, create a chat, send a message

## Local parity

```bash
npm run setup          # Docker Postgres + migrate
cp backend/.env.example backend/.env   # add ANTHROPIC_API_KEY
npm run dev:backend    # :3001
npm run dev:frontend   # :5173
```

Optional: `npx vercel dev` at repo root (requires Vercel CLI + linked project).
