# Pensieve

Pensieve is a Vite/React memory capture app with an Express/Postgres API. The
backend stores raw memory entries, asks OpenAI for a one-sentence summary, and
serves the timeline/detail flow.

## Local Setup

1. Copy environment defaults:

   ```sh
   cp .env.local.example .env.local
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

2. Set `OPENAI_API_KEY` in `.env.local`.

3. Create or open a Supabase project, then set these auth values:

   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `backend/.env`
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `frontend/.env.local`

   The URL is `https://<project-ref>.supabase.co`; the anon key is under
   Supabase Project Settings -> API.

4. In Supabase Auth, enable the Google provider and add
   `http://localhost:5173` as an allowed redirect URL.

5. Start Postgres and run migrations:

   ```sh
   npm run db:up
   npm run db:migrate
   ```

6. Start the apps:

   ```sh
   npm run dev:backend
   npm run dev:frontend
   ```

The local API runs on `http://localhost:3001`; Vite proxies `/api` requests from
the frontend dev server. Docker publishes local Postgres on host port `5433`,
so host-run Node commands should use `DB_PORT=5433`.

The backend loads environment values from root `.env`, root `.env.local`,
`backend/.env`, and `backend/.env.local`. Put shared local secrets like
`OPENAI_API_KEY` in root `.env.local`; keep backend-only database defaults in
`backend/.env`. Vite reads frontend auth values from `frontend/.env.local`.

## Docker Modes

For normal development, use Docker for the database only:

```sh
npm run db:up
npm run db:migrate
npm run dev:backend
npm run dev:frontend
```

`npm run db:up` starts only the `postgres` service. It does not start the Docker
backend or frontend, so it will not occupy local dev ports `3001` or `5173`.

To run the whole app in Docker instead:

```sh
npm run compose:up
```

The Docker frontend is exposed at `http://localhost:5174`. The Docker backend is
only exposed inside the Compose network, so it will not conflict with a local
backend on `3001`.

## API

- `GET /api/memory-entries` lists memories newest first.
- `POST /api/memory-entries` saves `rawInput`, generates `ai_summary`, and stores both.
- `GET /api/memory-entries/:id` opens one memory.
- `PATCH /api/memory-entries/:id` updates `rawInput`, `title`, and/or `summary`; changing only
  `rawInput` regenerates the summary.
- `DELETE /api/memory-entries/:id` removes a memory.

Reflection sessions can be resumed with `GET /api/reflection-sessions/active`. Posting
`{ "replaceActive": true }` to `POST /api/reflection-sessions` archives an unfinished
conversation and starts a fresh reflection.

All memory endpoints require `Authorization: Bearer <supabase_access_token>`.
The backend verifies that token with Supabase Auth and scopes every memory query
to the authenticated user id.

## Verification

Run checks in each app:

```sh
cd backend && npm run typecheck && npm test && npm audit
cd frontend && npm run typecheck && npm test && npm audit
```

Backend integration tests require a test database:

```sh
createdb -U pensieve pensieve_test
cd backend
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test
```
