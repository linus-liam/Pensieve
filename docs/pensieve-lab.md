# Pensieve Lab

Pensieve Lab is Linus's fast internal product-learning surface before an external beta. It uses the existing private phone web app at <https://pensieve-phone.vercel.app> so interaction changes can reach the same iPhone entry point without rebuilding and signing the native app each time.

## Change-and-observe loop

1. Linus describes one bounded product change in Codex.
2. The change is implemented and verified on a `codex/` branch.
3. After the mobile build passes, the agent deploys it to the existing `pensieve-phone` Vercel project when the task authorizes deployment.
4. Pensieve Lab detects the new service worker and shows **Pensieve Lab 有新版**.
5. Linus chooses **刷新到新版**. IndexedDB data remains under the same origin; the refresh changes application assets, not the database.
6. Linus evaluates the change immediately and reports whether to keep, revise or roll it back.

The header and Settings show the short source revision for the running build. `build-info.json` exposes the same revision and build time without caching, so a screenshot or report can identify the tested version.

## What can change at each speed

- Interaction and layout changes use this Lab deployment loop.
- Prompt, model and experiment configuration should eventually move to authenticated remote settings when Liam accepts the design; they are not yet remotely editable.
- Native-only capabilities still require a signed iOS build.

## Data and rollback

The Lab must keep the same production origin and IndexedDB database name (`pensieve-phone-v1`) across deployments. Schema changes require forward-compatible migrations and a backup/restore test. A deployment must never clear browser data or rename the database merely to simplify development.

Before a risky change, download a complete device backup from Settings. Vercel retains immutable deployments; rollback means promoting the previously verified deployment in the `pensieve-phone` project, then asking the Lab to check for an update. Rolling application assets back does not roll local data back, so incompatible schema changes require an explicit migration plan.

Secrets remain server-side. Do not put an OpenAI key, access code or signing secret into the frontend, Git, build metadata or documentation.

## Build and deploy

```sh
npm run build:mobile
vercel deploy --prod --yes --local-config vercel.mobile.json --scope ziyue-lins-projects
```

The fixed URL is the evaluation surface. A successful platform deployment is not enough to claim the loop works: verify on the installed iPhone home-screen app that the update prompt appears, refreshing shows the expected revision, and existing synthetic test data remains readable.
