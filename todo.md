# Admin: who uses Tumbaland, and how

**Status: built in the working tree on `main`, not committed.** Review the diff,
then say when to branch, commit and open the PR (`feat/admin`).

An admin area for the owner, to see each account's visits, the parts of the app
they open, quota, connected apps and assistant use, plus a queue for account
deletion requests. All of it is one PR.

## The PR

- **Branch:** `feat/admin`
- **Title:** `feat(admin): add an admin area for user activity and deletion requests`
- **Release note:** none. The partner sees no change. The only new text anyone can
  meet is "This account was closed at your request…", shown to someone whose
  deletion an administrator confirmed.
- **Merge:** the merge job will **not** merge it, because it touches `apps/infra`.
  The owner merges after the steps under "Before it ships". Say so in the PR body.

## What was built

### Visit counting
- [x] `user_days` (backend-core `UserDay`): a counter per person per UTC day (visits,
      opens per module, platform split, country), no TTL.
- [x] `recordActivity()`: one upsert, never throws, modules checked against a fixed list.
- [x] `POST /auth/activity` in auth-service: session only, validated, always 204.
- [x] shell-front sender and `useActivity` hook: a visit on load and after 30 minutes
      away, an open when the page changes module, nothing while signed out.
- [x] Privacy page: a row saying what is counted, and a new "last updated" date.
- [x] `backfillUserDays` and `npm run backfill:user-days` (dry run unless `--apply`).

### admin-service (read only, port 5008)
- [x] `requireAdmin` moved to backend-core; payment-service uses it. It also refuses keys.
- [x] `GET /api/overview`, `/api/users`, `/api/users/:id`, `/api/assistants`, `/api/deletions`.
- [x] Counts, dates and names only. Tests assert no `changes`, `snapshot`, key hash,
      token hash, raw user agent or entry text appears in any response.
- [x] Tests run against a real MongoDB (in memory), because the work is aggregation.
- [x] `docs/openapi.yml`, compose, `.env.example`, Prometheus job.

### admin-front (port 3009)
- [x] Overview, Users, User detail, Assistants, Deletions.
- [x] Charts follow the data-viz specs and the chart colour was run through the
      palette validator in light and dark. Every chart has a table view.
- [x] In the shell under Account, for administrators only.

### Account deletion queue
- [x] `deletionConfirmedAt` / `deletionConfirmedBy` on `User`.
- [x] `POST /auth/admin/users/:id/deletion/confirm` and `/reopen` in auth-service.
      Confirm: sessions deleted, token version bumped, refresh tokens and API keys
      revoked, audit row written. Refuses your own account. The role is read from the
      database.
- [x] A closed account cannot sign in; auth-front shows the message for `account_closed`.
- [x] Nothing is deleted.

### Wiring
- [x] `docker/services.json`, CI path filters, deploy workflows, `write-deploy-env.sh`
      and the three workflow `env:` blocks, root `.env.example`, dev scripts, README,
      DEPLOYMENT.md, proxy blocks, cloudflared hostnames, `package-lock.json`.

## Where it differs from the first plan

- **Module keys are route segments**, not display names: `home, relationship, album,
  finance, chat, account, groups, payments, admin`. The screens translate them
  (`relationship` shows as Journal). Routes are what stay put.
- **Paths:** the visit endpoint is `/auth/activity`; admin-service answers under `/api/…`.
- **No count badge on the Admin menu entry.** The menu is drawn by the shell from a
  static list, and a badge would make the shell call the admin API. The pending
  count is a tile on the Overview that links to Deletions.
- **A non-administrator at `/admin`** gets what any unknown address gets in the shell
  (an empty page). Signed out, they still reach the sign-in gate.
- **A rate guard on opens:** the same page is not reported twice within 10 seconds,
  since auth-service's rate limit is per address and shared with session checks.
- **Assistant names come from the audit rows** (`actorLabel`), not a join to the
  client registry, which would have lost apps since removed.
- **`aiJobs` shows as "not counted yet"**: nothing increments it.

## Before it ships (owner, in order)

1. ~~Add repository **variables** `ADMIN_API_URL` (`https://admin-api.tumbaland.eu`) and
   `ADMIN_FRONT_URL` (`https://admin.tumbaland.eu`), and add
   `https://admin.tumbaland.eu` to `CORS_ORIGIN`.~~ **Done.**
2. ~~Add the hostnames `admin.tumbaland.eu` and `admin-api.tumbaland.eu` to the
   Cloudflare tunnel (`apps/infra/cloudflared/README.md`, **No TLS Verify** on).~~ **Done.**
3. Run `deploy-infrastructure.yml` against `feat/admin`. Until the merge the two
   hostnames answer 502, which is expected.
4. Merge. Watch `release.yml`: backend-core publishes, then auth-service,
   payment-service, admin-service, shell-front, auth-front, admin-front deploy.
5. Run the backfill once (dry run first); see DEPLOYMENT.md, "The administration area".
6. Give your account the role (same section). It reaches the token within about 15
   minutes of use, or at the next sign-in.
7. Open `/admin` as yourself, and as an ordinary account to see it is not there and
   the API answers 403.
8. Look at Deletions before confirming anything: confirming closes that account on
   production.

## Checks run

typecheck and `test:coverage` pass for `@tumbaland/backend-core`, `auth-service`,
`payment-service`, `admin-service`, `shell-front`, `admin-front` and `auth-front`;
`npm run lint` exits clean; `image-build.mjs --check`, `validate-ci-matrix.js` and
`sync:libs:check` pass; `npm ci --dry-run` resolves for both new workspaces;
`admin-service` and `admin-front` build. Not run: a Docker image build, and the
screens in a browser against real data.

## Not in this PR

- Actually removing a closed account's data across the services and object storage.
- A screen for the payment grants and plans that already exist.
- Revoking one connected app or key from the admin side.
