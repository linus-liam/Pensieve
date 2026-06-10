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

No separate migrate step is required on Vercel. The API lazily creates the
`memory_entries` table on first request via `backend/src/db/schema.ts`.

## 3. Environment Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Used to generate one-sentence memory summaries. |
| `POSTGRES_URL` | Yes | Managed Postgres connection string. |
| `FRONTEND_URL` | Optional | Production URL, for CORS. |
| `AI_SUMMARY_MODEL` | Optional | Defaults to `gpt-4o-mini`. |

## 4. Verify

- `https://<your-domain>/api/health` returns `{"ok":true}`.
- Create a memory in the app, then confirm it appears in the timeline.

## Local Parity

```sh
npm run setup
cp backend/.env.example backend/.env
npm run dev:backend
npm run dev:frontend
```
