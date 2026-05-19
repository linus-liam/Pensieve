# Pensieve

Pensieve is a Vite/React frontend with an Express/Postgres backend that uses Anthropic for assistant replies and generated chat titles.

## Local Setup

1. Copy environment defaults:

   ```sh
   cp backend/.env.example backend/.env
   ```

2. Set `ANTHROPIC_API_KEY` and replace `SESSION_SECRET` with a long random value.

3. Start Postgres and run migrations:

   ```sh
   npm run db:up
   npm run db:migrate
   ```

4. Start the apps:

   ```sh
   npm run dev:backend
   npm run dev:frontend
   ```

The Docker Postgres password and published `5432` port are for local development only.

## Security Model

- Users authenticate with a server-side session cookie.
- Chats are scoped by `user_id`; callers cannot read or write another user's chats by guessing IDs.
- Message submissions are rate-limited and validated before any Anthropic call.
- The backend stores chat history in Postgres and sends the relevant conversation window to Anthropic to generate replies.

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
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5432/pensieve_test npm test
```
