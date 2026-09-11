# Pensieve

Pensieve is a Vite/React memory capture app with an Express/Postgres API. The
backend stores raw memory entries, asks OpenAI for a one-sentence summary, and
serves the timeline/detail flow.

## 本地个人模式（推荐自己使用）

```sh
npm ci
npm run local
```

打开 http://127.0.0.1:5175 。无需 Google 登录、数据库或 OpenAI API Key。
完整聊天、回顾和历史保存在本机。**AI 聊天需要另外配置模型**，不会使用你的 ChatGPT 网页会话或订阅登录。

1. 在项目根目录 `.env.local` 设置 `OPENAI_API_KEY`（密钥不要粘贴进聊天）。可选 `AI_CHAT_MODEL` 指定模型，默认沿用项目已有的 `gpt-4o-mini`。
2. 重新运行 `npm run local`，在聊天里勾选“本次聊天使用 OpenAI”。当前会话消息会发送给 OpenAI 生成回复；其他聊天不会自动发送。请求使用 `store: false`，仍受 [OpenAI 数据处理政策](https://developers.openai.com/api/docs/guides/your-data) 约束。
3. 直接聊天。每条原文先保存在电脑，再生成 AI 回复；回复失败可重试。
4. 当 AI 提出回顾，或你点击“聊到这里，整理回顾”，可以修改文本再确认。只有确认后的回顾进入 Memories，并能回到完整聊天。

如果本机需要代理访问 OpenAI，可在 `.env.local` 设置 `OPENAI_PROXY_URL=http://127.0.0.1:你的代理端口`。后端不会自动继承 macOS 系统代理；此配置仅用于 OpenAI 请求。

未配置模型也能先保存消息、手写回顾。旧的单篇文字存档入口在“直接保存旧文字”。

- **位置：**项目 `.pensieve/memories/`，会话位于其 `sessions/` 子目录；界面显示绝对路径。关闭页面、重启不会删除已保存内容。
- **追溯：**每条消息保留原文和时间；AI 草稿与确认回顾分开；修改、归档、恢复保留历史。记忆详情可回到来源聊天。
- **导出与备份：**导出 Markdown 包含完整聊天、所有草稿与回顾历史。完整备份请复制整个 `.pensieve` 文件夹；恢复时停止应用，将备份放回原目录再启动。
- **自定义目录：**`PENSIEVE_DATA_DIR=/absolute/path/to/memories npm run local`。换目录不会自动迁移原数据。
- **旧内容：**可粘贴旧笔记或聊天到文字存档，每条最多 500,000 字符；记录时间是本次保存时间，旧日期请随原文保留。尚未自动导入 ChatGPT 或旧云端数据。

本地服务仅监听 `127.0.0.1`，每次启动生成临时访问令牌。数据文件未加密，受本机账户权限保护；`.pensieve/` 被 Git 忽略。同一目录仅运行一个本地服务。数据仍需自行备份。

[本版体验、数据结构与后续方向](docs/local-reflection.md)。

下面保留原云端开发流程；`npm run local` 不需要这些配置。

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
- `PATCH /api/memory-entries/:id` updates `rawInput` and regenerates the summary.
- `DELETE /api/memory-entries/:id` removes a memory.

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
