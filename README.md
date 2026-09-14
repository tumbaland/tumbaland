# Tumbaland Monorepo

## Workspace Layout

npm workspaces monorepo with three workspace groups:

- `apps/backend/*` — Express + MongoDB services (auth, album, finance, relationship, payment,
  group, file, public). Each service is a thin `routes → controllers → services → models` stack
  built on `@tumbaland/backend-core`.
- `apps/frontend/*` — Vite + React + MUI single-page apps, one per domain, plus `shell-front` which
  hosts the top-level shell/navigation. Each app owns a `ConfigProvider` (built on
  `@tumbaland/components`'s `createConfigProvider`) and its own domain services (built on
  `@tumbaland/frontend-core`'s `createApiClient`).
- `libs/*` — shared packages published to the other two groups:
  - `@tumbaland/backend-core` — backend: `createBaseApp`, auth/CORS/rate-limit/validation middleware,
    the typed `HttpError` hierarchy + `errorHandler`, `sendSuccess`/`sendError` response helpers,
    logger, metrics, tracing.
  - `@tumbaland/components` — frontend: shared React components (`AuthHeader`, `Loader`,
    `ErrorPage`, …), `createConfigProvider` (per-app dev/prod config loading + monitoring init),
    and the monitoring layer (`logger`, `captureException`/`captureMessage`, correlation IDs).
  - `@tumbaland/frontend-core` — frontend: `createApiClient` (generic authenticated fetch wrapper),
    `createAuthService`, `createGroupService` — factories each frontend instantiates with its own
    config accessor.

## Ports (local dev)

| Frontend | Port | | Backend | Port |
|---|---|---|---|---|
| shell-front | 3000 | | relationship-service | 4001 |
| relationship-front | 3001 | | album-service | 4002 |
| album-front | 3002 | | finance-service | 4003 |
| finance-front | 3003 | | auth-service | 5001 |
| auth-front | 3004 | | file-service | 5002 |
| payment-front | 3005 | | public-service | 5003 |
| group-front | 3006 | | payment-service | 5005 |
| account-front | 3007 | | group-service | 5006 |
| | | | mcp-service | 5007 |

See `.env.example` for the full variable list (`VITE_*` for frontends, plain names for backend
services).

## Quick Start

1. **Copy and configure environment variables:**
   - Copy `.env.example` to `.env` for each app root directory and fill in missing values.

2. **Start local development:**

   ```sh
   npm run dev
   ```

3. **Access the app:**
   - Main site: http://localhost:3000
   - Other services: see Nginx config for subdomains.

4. Enter Server
   ```sh
   ssh tom@192.168.0.131
   ```

## Mobile apps (not built yet)

There are no iOS or Android apps yet. The intended shape is a thin Capacitor wrapper (a new
`apps/mobile` workspace) that loads the live site at `https://tumbaland.eu`, so the shell, the
framed apps and the `.tumbaland.eu` session cookie keep working as they are. Bundling the shell
into the app would put it on another origin, where that cookie is never sent.

Already in place:

- `shell-front/src/services/platform.ts`: `getAppPlatform()` and `isNativeApp()` detect the
  wrapper, and `canOfferPurchases()` hides Billing and "See plans" inside an app, since the
  stores require their own billing for those.
- The shell layout keeps clear of the notch and status bar (`env(safe-area-inset-*)`); the tab
  bar already pads for the home indicator.
- auth-service accepts Google tokens from the native client IDs in `GOOGLE_NATIVE_CLIENT_IDS`.
  Google blocks its sign-in page inside web views, so an app signs in with a native Google plugin
  and posts the ID token to `/auth/validate`, the same call the web button makes.

Still to do when the apps are built:

- Sign in with Apple, which iOS requires next to Google sign-in: an auth-service endpoint that
  verifies Apple's identity token and sets the same cookie.
- Account deletion has to actually delete; today it only records the request.
- Session length: the cookie lasts 7 days, so an app would sign people out every week.
- `apple-app-site-association` and `assetlinks.json` in `apps/infra/tumbaland-proxy`, so links
  to the site open the app.
- Links outside `*.tumbaland.eu` should open in the system browser.

## Commits & Releases

Use [Conventional Commits](https://www.conventionalcommits.org/) for every commit, everywhere in
this repo: `type(scope): description`, e.g. `fix(finance-service): correct snapshot rounding`,
`feat(album-front): add collage zoom`. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`,
`chore`, `perf`. This is what drives both versioning mechanisms below — write real, correctly-typed
messages even for app-only changes.

### App changes (services, frontends) — nothing to do

Every push to `main` runs `.github/workflows/changelog.yml`, which bumps the root
`package.json`, appends to the root `CHANGELOG.md`, and tags `app-vX.Y.Z`. This is a monorepo-wide
history marker only — it is **not** consumed by deploys (those tag Docker images `:latest` and
`:{sha}`, see `deploy-single-service.yml`) and is never published anywhere. You don't run anything
for this; just commit with the right type/scope and it happens on merge.

### Library releases (`libs/backend-core`, `libs/frontend-core`, `libs/components`) — manual, per package

These three are real npm packages (`@tumbaland/*`) that every app depends on via `"*"` and that get
installed from the registry, not just workspace-linked. Cut a release only when you've made a
change worth publishing:

1. Land your commits on `main` first, scoped to the lib that changed
   (`fix(backend-core): ...`, `feat(components): ...`).
2. `cd libs/<package>`
3. `npm run release` — bumps that package's own `version` from the commits since its last tag,
   writes/updates its `CHANGELOG.md`, creates a `chore(release): X.Y.Z` commit, tags it
   (`backend-core-vX.Y.Z` / `frontend-core-vX.Y.Z` / `components-vX.Y.Z` — each package has its
   own tag namespace so releases can never collide), builds, and publishes to npm.
   Use `npm run release:beta` for a prerelease (`-beta.0`, tagged `beta` on npm).
4. `git push origin main --follow-tags`
5. Apps pin `"@tumbaland/x": "*"`, so nothing else needs bumping — `npm install` at the repo root
   picks up the new published version.

**Always release through `npm run release` — never hand-edit a lib's `package.json` version and
run `npm publish` directly.** That shortcut is how `backend-core` and `components` ended up
published on npm with no matching `CHANGELOG.md` or git tag at all: the registry, the changelog,
and git history all drifted out of sync with each other. Going through the script keeps all three
in lockstep.
