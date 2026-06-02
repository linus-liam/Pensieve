# Deploy Pensieve on Vercel (GitHub)

Push to `main` → Vercel builds and deploys automatically once the repo is linked.

## 1. Link GitHub on Vercel

1. [vercel.com/new](https://vercel.com/new) → Import `Pensieve` repo
2. **Root Directory**: `.` (repo root)
3. Framework Preset: **Other** (uses `vercel.json`; API entry is `api/index.ts`)
4. Deploy once (will fail until env + DB are set)

## 2. Add Postgres (Supabase)

The backend talks to Postgres directly via `pg` (no ORM, no `@supabase/supabase-js`),
so all you need is the **connection string** — the `anon` / `service_role` keys are not used.

1. Create a project at [supabase.com](https://supabase.com) (set a database password)
2. **Project Settings → Database → Connection string** → use the **Connection Pooling
   (Transaction)** value, e.g.
   `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`

No separate migrate step is needed: the API creates the full schema (`users`,
`session`, `chats`, `messages`) automatically on the first request against an
empty database (see `backend/src/db/schema.ts`). To pre-create it explicitly,
run `POSTGRES_URL="<your-supabase-url>" npm run db:migrate --prefix backend`.

> SSL is enabled automatically for `*.supabase.co` / `*.pooler.supabase.com` hosts.

## 3. Environment variables

In Vercel → **Settings** → **Environment Variables**:

| Variable | Required | Notes |
|----------|----------|--------|
| `ANTHROPIC_API_KEY` | Yes | [Anthropic console](https://console.anthropic.com/) |
| `POSTGRES_URL` | Yes | Supabase pooler connection string |
| `SESSION_SECRET` | Yes | Long random string for session cookies |
| `FRONTEND_URL` | Optional | Production URL, e.g. `https://pensieve.vercel.app` |

## 4. Redeploy

**Deployments** → latest → **Redeploy** (or push an empty commit).

Build runs: backend compile → frontend build → copy to `public/`.
The API creates the full database schema (`users`, `session`, `chats`, `messages`)
on the first request, so builds do not need direct database access during `vercel build`.

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
