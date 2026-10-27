# Tumbaland Monorepo

## Workspace Layout

npm workspaces monorepo with three workspace groups:

- `apps/backend/*` — Express + MongoDB services (auth, album, finance, relationship, payment,
  group, file, public, mcp, admin). Each service is a thin `routes → controllers → services → models` stack
  built on `@tumbaland/backend-core`.
- `apps/frontend/*` — Vite + React + MUI single-page apps, one per domain, plus `shell-front` which
  hosts the top-level shell/navigation. Each app owns a `ConfigProvider` (built on
  `@tumbaland/frontend-core`'s `createConfigProvider`) and its own domain services (built on
  `@tumbaland/frontend-core`'s `createApiClient`).
- `libs/*` — shared packages published to the other two groups:
  - `@tumbaland/backend-core` — backend: `createBaseApp`, auth/CORS/rate-limit/validation middleware,
    the typed `HttpError` hierarchy + `errorHandler`, `sendSuccess`/`sendError` response helpers,
    logger, metrics, tracing.
  - `@tumbaland/frontend-core` — frontend: shared React components (`AuthHeader`, `Loader`,
    `ErrorPage`, `GroupSelector`, …), `createConfigProvider` (per-app dev/prod config loading +
    monitoring init), the monitoring layer (`logger`, `captureException`/`captureMessage`,
    correlation IDs), and the factories each frontend instantiates with its own config accessor:
    `createApiClient` (generic authenticated fetch wrapper), `createAuthService`,
    `createGroupService`. Also what a shared photo or link turns into on arrival
    (`readShare`, `sharedMessage`).
  - `@tumbaland/collage-core` — both sides: what a collage is (reading and writing its stored
    config) and how it is drawn on a canvas, so the editor's export, the server's preview and
    the assistant's tools agree.

## Ports (local dev)

| Frontend | Port | | Backend | Port |
|---|---|---|---|---|
| shell-front | 3000 | | relationship-service | 4001 |
| relationship-front | 3001 | | album-service | 4002 |
| album-front | 3002 | | finance-service | 4003 |
| finance-front | 3003 | | chat-service | 4004 |
| auth-front | 3004 | | auth-service | 5001 |
| payment-front | 3005 | | file-service | 5002 |
| group-front | 3006 | | public-service | 5003 |
| account-front | 3007 | | payment-service | 5005 |
| chat-front | 3008 | | group-service | 5006 |
| admin-front | 3009 | | mcp-service | 5007 |
| | | | admin-service | 5008 |

Every app has an `.env.example` listing exactly what it reads, with localhost defaults: plain
names for backend services, `VITE_*` for frontends. The root `.env.example` is the production
list, the names `.github/scripts/write-deploy-env.sh` writes for the compose files.

## Quick Start

1. **Copy and configure environment variables:**
   - Copy `.env.example` to `.env` in each app directory and fill in the blanks. The secrets
     (`MONGODB_URI`, `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, `FILE_SERVICE_API_KEY`) must be the
     same in every service that has them.

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

### Getting a change onto `main`

Nothing is pushed to `main`. Work on a branch and open a pull request:

1. `git switch -c fix/short-name`, commit, push, open a PR.
2. CI (`ci.yml`) runs on the PR. The one check that has to be green is `ci-passed`, which
   includes the title check.
3. The `merge` job in `ci.yml` squash merges it once `ci-passed` is green. This repository is
   private on a plan without branch protection, so that job is the only gate: do not merge by hand
   while CI is still running.

The **PR title becomes the commit on `main`**, and the version bump and `CHANGELOG.md` are built
from it, so it has to be a [Conventional Commit](https://www.conventionalcommits.org/):
`type(scope): description`, e.g. `fix(finance-service): correct snapshot rounding`. Types: `feat`,
`fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`. The title check rejects anything else.
The commits inside the branch can be as messy as they like; they are squashed away.

The rules live in `.github/rulesets/main.json`. GitHub does not read that file by itself: import it
under **Settings → Rules → Rulesets** when setting up the repository.

### What a merge does

A merge to `main` starts `release.yml`. It does not test anything, because the PR already did:

1. Works out which libraries and which services changed (`scripts/release-plan.mjs`). A merge that
   only touches tests, e2e suites or Markdown plans an empty release and stops.
2. Publishes each library with publishable changes to npm (`publish-libs.yml`) and re-pins its
   consumers. This stage checks the library once more on its own, because a publish cannot be
   undone.
3. Bumps the root version, writes `CHANGELOG.md` and tags `app-vX.Y.Z`.
4. Builds an ARM image for each changed service and deploys them to the Pi one at a time, then
   tags `app-deployed-vX.Y.Z`.

So every deploy has its own version and the number counts releases. It says nothing about how big
a change was. What people are told lives in the release notes
(one small file per change in `apps/frontend/shell-front/src/release-notes/`, added in the same PR),
written for them, not in `CHANGELOG.md`, which is the developer log.

A release that failed after tagging is picked up by the next one, which builds everything changed
since the last `app-deployed-v` tag. To retry a failed deploy without a new merge, open the failed
run in the Actions tab and choose **Re-run failed jobs**: it deploys the same version again from
the images already built. Running **Release** by hand instead works too, but it cuts a new version
even when nothing changed. See `.github/DEPLOYMENT.md` for rollback and the manual deploys.

### Libraries (`libs/backend-core`, `libs/frontend-core`, `libs/collage-core`)

These are real npm packages (`@tumbaland/*`), installed from the registry by every image, so there
is nothing to run by hand: change the library in a PR, and its merge publishes it. The version is
derived from the conventional commits that touched the library since it last changed (breaking is
major, `feat` is minor, anything else patch).

Never edit a library's `package.json` version or run `npm publish` yourself. That is how the
registry, the changelog and git history drifted apart before; publishing through the workflow keeps
all three in step.


### Images

Every service ships as an image built from the repository root, with one of two shared
Dockerfiles: `docker/Dockerfile.front` and `docker/Dockerfile.back`. Both install with `npm ci`
from the root `package-lock.json`, the same file local development and CI use, and build the
library (`libs/*`) from the same commit. So what runs in production is what was tested, and the
shell and its modules cannot end up on different versions of React or MUI.

- What differs per service (a backend's port, the shell's version) is data in
  `docker/services.json`. `node scripts/image-build.mjs <service> --cli` prints the `docker build`
  command for one.
- A pull request builds the image of every app it touches (ARM, like the Pi) without pushing, so
  a change that only breaks inside an image fails the pull request and not the deploy.
- A release rebuilds a service when its files, its library, its Dockerfile or the packages it
  installs from the lockfile changed (`scripts/release-plan.mjs`), so a dependency bump nobody
  uses does not redeploy everything.
- To upgrade a dependency, change it at the root and commit `package-lock.json`: `npm update
  <package>`, then run the tests. There is nothing to sync per app.
- Do not list a platform-specific binary (`@rollup/rollup-linux-x64-gnu`, `@esbuild/linux-x64`) as a
  dependency. The lockfile already carries every variant, and a binary for one platform makes
  `npm ci` fail on the others, which is how the images first failed to build from the lockfile.
