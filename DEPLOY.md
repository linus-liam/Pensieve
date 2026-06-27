# Deploy Pensieve on Vercel

Push to `main` and Vercel builds/deploys automatically once the repo is linked.

## 1. Link GitHub on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the `Pensieve` repo.
2. Set **Root Directory** to `.`.
3. Use **Framework Preset: Other**. The project uses `vercel.json`.
4. Deploy once, then add env vars if the first deploy is missing them.

## 2. Add Postgres

The backend talks to Postgres directly via `pg`, so it only needs a connection
string. Supabase, Neon, or Vercel Postgres all work.

For Supabase, use **Project Settings -> Database -> Connection string** and copy
the pooled connection string.

No separate migrate step is required on Vercel. The backend lazily creates the
`memory_entries` table on first request via `backend/src/db/schema.ts`.

## 3. Configure Auth

In Supabase Auth, enable the Google provider. Add your production Vercel URL to
the allowed redirect URLs, for example `https://<your-domain>`.

## 4. Environment Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Used to generate one-sentence memory summaries. |
| `POSTGRES_URL` | Yes | Managed Postgres connection string. |
| `SUPABASE_URL` | Yes | Backend Supabase project URL for token verification. |
| `SUPABASE_ANON_KEY` | Yes | Backend anon key used with Supabase Auth. |
| `VITE_SUPABASE_URL` | Yes | Frontend Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Yes | Frontend anon key used by the browser client. |
| `FRONTEND_URL` | Optional | Production URL, for CORS. |
| `AI_SUMMARY_MODEL` | Optional | Defaults to `gpt-4o-mini`. |

## 5. Verify

- `https://<your-domain>/api/health` returns `{"ok":true}`.
- Sign in with Google, create a memory, then confirm it appears in the timeline.

## Local Parity

```sh
npm run setup
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm run dev:backend
npm run dev:frontend
```
