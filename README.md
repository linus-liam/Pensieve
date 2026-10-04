# Pensieve

Pensieve is a Vite/React memory capture app with an Express/Postgres API. The
backend stores raw memory entries, asks OpenAI for a one-sentence summary, and
serves the timeline/detail flow.

## iPhone 原生私用开发版

原生 iOS 工程位于 [`ios/PensievePrivate.xcodeproj`](ios/PensievePrivate.xcodeproj)，构建、签名、设备验收步骤见 [`ios/README.md`](ios/README.md)。它在设备本地保存完整原始聊天；AI 密钥由使用者在手机设置中输入。真机安装、真实 AI 对话和后续版本保留数据仍需按说明验收。

## 之前的 iPhone Web Preview

> 当前下一步（2026-10-01）：先交付供 Linus 与 Liam 私用的 iOS 版本；不要求同步或登录，沿用当前流程与界面，在设备本地保留完整原始对话，并保证后续开发版本能够继续读取已有数据。范围与验收见 [`docs/ios-first-private-build.md`](docs/ios-first-private-build.md)。下方地址是此前已经部署的 Web Preview。

手机地址：[Pensieve](https://pensieve-phone.vercel.app)。在 Safari 中打开，先添加到主屏幕，再从图标开始记录。网页与 AI 服务独立部署，Mac 不需要保持开机。当前服务已部署；AI 密钥上传到 Vercel 的明确授权仍待确认，因此线上暂可保存原文，尚不能回复。

手机记录保存在当前设备，不会自动同步 Mac。请在设置中下载完整备份并保存到“文件”。连接、恢复、时间处理和本轮验收见 [手机试用说明](docs/mobile-preview.md)。

## 本地个人模式（推荐自己使用）

```sh
npm ci
npm run start:local
```

在 Finder 中双击项目根目录的 **打开 Pensieve.command**，或运行上面的命令。它会在后台启动服务并打开 http://127.0.0.1:5175 ，再次打开会复用已有服务。关闭页面或终端不会停止后台服务；电脑重启后需要再次打开。停止服务用 `npm run stop:local`；开发时仍可用 `npm run local` 在前台运行。

无需 Google 登录、数据库或 OpenAI API Key。
完整聊天、回顾和历史保存在本机。**AI 聊天需要另外配置模型**，不会使用你的 ChatGPT 网页会话或订阅登录。

1. 在项目根目录 `.env.local` 设置 `OPENAI_API_KEY`（密钥不要粘贴进聊天）。可选 `AI_CHAT_MODEL` 指定模型，默认沿用项目已有的 `gpt-4o-mini`。
2. 配置后先 `npm run stop:local`，再 `npm run start:local`。首次发送会说明 AI 的数据去向，选择“开启 AI 并发送”后，这个浏览器中的后续聊天也会使用 AI，可在“设置”关闭。选择“先只保存原文”则保持本机记录模式。当前会话消息会发送给 OpenAI 生成回复；其他聊天不会自动发送。请求使用 `store: false`，仍受 [OpenAI 数据处理政策](https://developers.openai.com/api/docs/guides/your-data) 约束。
3. 直接聊天。每条原文先保存在电脑，再生成 AI 回复；回复失败可重试。
4. 当 AI 提出回顾，或你点击“聊到这里，整理回顾”，可以修改文本再确认。只有确认后的回顾进入“记忆”，并能回到完整聊天。

如果本机需要代理访问 OpenAI，可在 `.env.local` 设置 `OPENAI_PROXY_URL=http://127.0.0.1:你的代理端口`。后端不会自动继承 macOS 系统代理；此配置仅用于 OpenAI 请求。

未配置模型也能先保存消息、手写回顾。旧的单篇文字存档入口在“留存已有文字”。过去的会话从侧边“过去的聊天”打开，窄屏入口是底部“历史”。

- **位置：**项目 `.pensieve/memories/`，会话位于其 `sessions/` 子目录；设置中显示绝对路径。关闭页面、重启不会删除已保存内容。
- **追溯：**每条消息保留原文和时间；AI 草稿与确认回顾分开；修改、归档、恢复保留历史。记忆详情可回到来源聊天。
- **导出与备份：**设置中的 Markdown 导出包含完整聊天、所有草稿与回顾历史。启动时、保存后约 1.5 秒，以及正常停止时会生成本机快照；设置中可查看最近备份或“立即备份”。恢复步骤见下方。
- **自定义目录：**`PENSIEVE_DATA_DIR=/absolute/path/to/memories npm run local`。换目录不会自动迁移原数据。
- **旧内容：**可粘贴旧笔记或聊天到文字存档，每条最多 500,000 字符；记录时间是本次保存时间，旧日期请随原文保留。尚未自动导入 ChatGPT 或旧云端数据。

本地服务仅监听 `127.0.0.1`，每次启动生成临时访问令牌。数据文件未加密，受本机账户权限保护；`.pensieve/` 被 Git 忽略。同一目录仅运行一个本地服务。快照与原文在同一台电脑上，不能应对电脑丢失或磁盘损坏；重要内容请另行复制到外置硬盘。

## 本机备份与恢复

快照默认位于 `.pensieve/memories/.backups/snapshot-…/`。保留最近 20 份，以及最近 30 个有备份日期的每日最后一份（按 UTC 日期）；内容未变化时不重复生成。每份快照包括原始聊天、回顾草稿、确认记忆、修改/归档历史和带 SHA-256 校验的清单，不包含 API Key、运行令牌或其他非记忆文件。

恢复会验证清单和每个文件，要求目标目录尚不存在，不覆盖正在使用的原文：

```sh
npm run stop:local
npm run restore:local -- "/完整路径/.backups/snapshot-…" "/完整路径/恢复后的记忆"
PENSIEVE_DATA_DIR="/完整路径/恢复后的记忆" npm run start:local
```

把示例路径替换为设置中实际备份路径与新的目标目录。自定义目录仅对此次启动生效，后续启动仍需传入相同的 `PENSIEVE_DATA_DIR`；根目录双击入口默认使用原目录。Markdown 导出适合阅读，完整恢复使用快照目录。

启动日志和临时访问令牌位于被 Git 忽略的 `.pensieve/runtime/`，令牌文件仅供本机启动器读取。若端口被其他进程占用，启动器会提示，不会自动终止其他程序。后台服务仍是面向自己使用的本地开发运行方式，尚未打包为独立桌面应用，也不启用开机自启动。电脑不联网时仍能记录和查看，云端 AI 需要联网。

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
