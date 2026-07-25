# Code Improvement TODO

A prioritized list of improvements from analyzing the monorepo (`apps/backend/*`,
`apps/frontend/*`, `libs/*`) at `3aa19bb`.

Baseline health: 461 source files / 322 test files, `eslint .` runs clean (0 errors, 231
warnings — all `no-explicit-any` in tests), no production `: any` or `as any` casts, and the
shared `createBaseApp` / `errorHandler` / `registerShutdown` / `createHealthCheck` primitives
are used consistently across all eight backend services. Coverage gates (90/80/90/90) are
enforced per workspace in CI and finance-service, for example, reports 100% lines.

The items below are the concrete gaps that survived that baseline, most impactful first.

## High priority — correctness & data integrity

- [ ] **Bound `getTickerPriceHistory()`.** `tickerPriceHistory.service.ts:21` is
      `TickerPriceHistory.find().sort({ date: -1 })` — no filter, no projection, no limit — and then
      re-sorts the whole result set in JavaScript. It loads the entire price-history collection into
      the service process on every request, and that collection grows by (tracked tickers × trading
      days) forever. Add pagination and push the ticker-then-date ordering into the Mongo sort.

- [ ] **Add tenancy-leading indexes to the multi-tenant models.** Every scoped read goes through
      `buildAccessQuery()`, which produces `{ $or: [{ userId }, { groupId: { $in: [...] } }] }`,
      usually combined with a sort on `date`/`createdAt`. But the compound indexes that exist don't
      lead with the tenancy field — `Activity` has `{ typeId: 1, date: -1 }`, `{ date: -1 }`,
      `{ createdAt: -1 }`; `Album` has only `{ updatedAt: -1 }`; `Photo` has
      `{ albumId: 1, createdAt: -1 }` — so neither `$or` branch can be served by one, and the sort
      spills to an in-memory sort. Add `{ userId: 1, <sortField>: -1 }` and
      `{ groupId: 1, <sortField>: -1 }` pairs to `Activity`, `Album`, `Photo`, `Holding`, and
      `DashboardSettings`.

  Four models carry **no** index at all: `auth-service/User`, `finance-service/AssetClass`,
  `finance-service/Holding`, `payment-service/Plan`. At minimum `User` needs its lookup key
  indexed — every lookup on it is currently a full collection scan.
  (`finance-service/TickerPriceHistory` now has `{ ticker: 1, date: 1 }` — see "Previously
  completed" below.)

- [ ] **Unify how services handle a failed DB connection at startup.** `connectDB()` rethrows on
      failure, but the eight `src/index.ts` files do four different things with that promise:

  | Service                                       | Behavior on Mongo being down at boot                         |
  | --------------------------------------------- | ------------------------------------------------------------ |
  | `auth-service`                                | `await`s, logs, `process.exit(1)` — the correct pattern      |
  | `group-service`                               | `.catch(logger.error)` — starts anyway and serves with no DB |
  | `album`, `finance`, `payment`, `relationship` | `connectDB(...)` un-awaited, un-caught                       |
  | `file`, `public`                              | no DB — N/A                                                  |

  The four un-awaited calls produce an **unhandled promise rejection**, which Node terminates the
  process over — so the outcome is "crash with an opaque stack trace" rather than the clean
  "log and exit 1" auth-service gets, and under Docker's restart policy that's a confusing crash
  loop. Adopt auth-service's shape everywhere, ideally by folding it into a
  `startService({ serviceName, app, port })` helper in `@tumbaland/backend-core` alongside
  `registerShutdown`.

## High priority — build reproducibility

- [ ] **Docker builds ignore the committed lockfile.** `deploy-single-service.yml` sets the build
      context to a single workspace directory (`./apps/frontend/album-front`), and every Dockerfile
      does `COPY package*.json ./` + `RUN npm i`. There is no per-workspace `package-lock.json` in
      the repo — only the root one, which is outside the build context — so `npm i` resolves the
      whole dependency tree fresh from the registry at image-build time, within the semver ranges.

  The practical consequences: **what CI tested is not what gets deployed**, and two deploys of
  the same commit SHA can ship different dependency trees. The backend Dockerfiles' second-stage
  `npm ci --omit=dev` doesn't rescue this — it consumes the lockfile `npm i` just generated in
  the builder, not the committed one. Fix by building from the repo root with the root lockfile
  in context (`npm ci --workspace=<name>`), or by generating and committing per-workspace
  lockfiles.

- [ ] **Pin the nginx base image.** Seven of the eight frontend Dockerfiles use the floating
      `FROM nginx:alpine`; only `shell-front` pins `nginx:1.26-alpine`. Pin all eight to the same
      explicit tag so a rebuild doesn't silently move the runtime out from under a service. (The
      backend Dockerfiles already do this correctly — all eight pin `node:26-alpine` and differ only
      in `EXPOSE`/healthcheck port.)

- [ ] **Scope deploy secrets per service.** The `Generate .env file` step in
      `deploy-single-service.yml` writes _every_ secret — `STRIPE_SECRET_KEY`, `JWT_SECRET`,
      `INTERNAL_SERVICE_TOKEN`, `FILE_SERVICE_HMAC_SECRET`, `GOOGLE_CLOUD_KEY_FILE_BASE64`,
      `CLOUDFLARE_API_TOKEN`, … — into one `.env.app` handed to whichever single service is being
      deployed. A frontend nginx container has no business holding the Stripe key. Split into
      per-service secret sets, or at least a shared set plus per-service additions.

## Medium priority — testing

- [ ] **The data layer has no contract tests.** The duplicate-upsert bug above sits in a file
      reporting **100% line coverage** — because `tickerPriceHistory.service.test.ts` starts with
      `jest.mock('../models/TickerPriceHistory', ...)` and asserts against a `jest.fn()`. Mongoose
      casting, query-filter shape, index usability, and upsert semantics are all mocked away, so this
      entire class of bug is structurally invisible to the current suite no matter how high the
      percentage goes.

  Add a thin integration layer (`mongodb-memory-server`) for the services that own real query
  logic — `finance-service`'s price/snapshot writes, `relationship-service`'s aggregation
  pipelines, `album-service`'s access-scoped finds — running against a real Mongo so filters and
  indexes are actually exercised. This is the single highest-leverage test investment left; the
  unit-level percentages are already saturated.

## Medium priority — DRY

- [ ] **Eight byte-identical `src/test/setup.ts` files (97 lines each, ~780 lines total).**
      `apps/frontend/{account,album,auth,finance,group,payment,relationship,shell}-front/src/test/setup.ts`
      all have the same md5 — the same `matchMedia`/`ResizeObserver` shims, the same `MemoryStorage`
      implementation, the same keyed `fetch` mock. Publish it once from `@tumbaland/components` (e.g.
      a `@tumbaland/components/test-setup` entry) and have each `vite.config.mts` point `setupFiles`
      at it. Today a fix to the shared fetch mock has to be applied eight times.

- [ ] **Eight near-identical `vite.config.mts` files.** They differ only in `server.port` and
      whether `@tumbaland/components` is aliased to source in dev — the other ~40 lines (the Oxc
      `dropConsole` build config with its explanatory comment, the jsdom test block, the coverage
      thresholds) are copy-pasted. Extract a `createFrontendViteConfig({ port, aliasComponents })`
      helper at the repo root and have each app call it.

- [ ] **Nine byte-identical `jest.config.js` files.** All eight backend services plus
      `libs/backend-core` share the same md5. Ship the config as a preset from `@tumbaland/backend-core`
      so the coverage thresholds and `collectCoverageFrom` exclusions live in one place.

- [ ] **Consolidate the two internal-service-token middlewares.** `auth-service`'s
      `requireInternalService` and `group-service`'s `validateInternalServiceToken` solve the same
      problem and have drifted apart: auth-service uses `requireEnv` and fails closed; group-service
      reads `process.env` directly, logs the failure at `error` level with the caller-supplied
      `x-service-id`, and returns `next()` when no token is present so a second middleware
      (`allowUserOrInternalService`) has to finish the job. Move one implementation into
      `@tumbaland/backend-core` and have both services consume it.

- [ ] **Seven byte-identical four-line `authService.ts` re-export shims** across the frontends.
      Small, but it's the same file seven times — import from `@tumbaland/frontend-core` directly.

- [ ] **Split `relationship-service/src/services/statistics.service.ts` (899 lines — the largest
      file in the repo).** It exports six large aggregation functions (`getRelationshipStatistics`,
      `getMonthlyHours`, `getMonthlyStatistics`, `getMonthlyActivityBreakdown`, `getWeeklyHeatmapData`,
      `getCumulativeTimelineData`) that repeat similar `$match`/date-bucketing pipeline fragments.
      Extract shared pipeline builders and split into per-concern modules (`statistics/monthly.ts`,
      `statistics/heatmap.ts`, `statistics/timeline.ts`).

- [ ] **De-duplicate the two album-front AI service clients.** `segmentationService.ts` (464
      lines) and `objectDetectionService.ts` (381 lines) independently define the same scaffolding —
      their own `getConfig()`, their own `HEALTH_CHECK_TIMEOUT = 3000`, their own `AIServiceError`,
      their own `HealthStatus`, and the same submit → poll-job → fetch-result lifecycle. Extract a
      shared `createAiServiceClient` base (one error type, one polling helper, one health check),
      mirroring how the frontends already share `@tumbaland/frontend-core`'s `createApiClient`.

- [ ] **Break up the largest frontend components.** `album-front/components/collage/CollageStage.tsx`
      (513) and `finance-front/components/TickerHistoryModal.tsx` (511) each mix data fetching, layout,
      and interaction in one component. Extract data hooks (`useCollageStage` / `useTickerHistory`) and
      presentational subcomponents so the units are independently testable.

## Medium priority — security hardening

- [ ] **Use constant-time comparison for shared secrets.** `file-service`'s HMAC signed-URL check
      correctly uses `crypto.timingSafeEqual` (`utils/hmac.ts`), but three other secret comparisons in
      the same codebase use plain `!==`: `file-service/middleware/auth.ts`'s `requireApiKey`
      (`key !== process.env.FILE_SERVICE_API_KEY`), and both internal-service-token checks in
      auth-service and group-service. Add a `timingSafeCompare(a, b)` helper to `@tumbaland/backend-core`
      and route all four through it.

- [ ] **Harden group-service's internal-auth bypass.** `group-service/middleware/authMiddleware.ts`
      skips JWT verification entirely whenever an `x-internal-token` header is _present_, deferring the
      actual check to `validateInternalServiceToken`, which is mounted inside `groupRoutes.ts`. That
      holds today — every route in that file mounts `allowUserOrInternalService` — but it's enforced
      only by convention. Any new router mounted under `app.use('/api', authenticateToken)` without
      that second middleware is reachable completely unauthenticated by sending an arbitrary
      `x-internal-token` header. Make the bypass verify the token itself instead of trusting a
      downstream mount, so the safe behavior doesn't depend on remembering.

## Lower priority — code quality

- [ ] **Audit the `react-hooks/exhaustive-deps` suppressions (5 sites).**
      `finance-front/pages/PortfolioPlanner.tsx` (2×), `finance-front/components/planner/ProjectionSection.tsx`,
      `relationship-front/components/TotalDaysChart.tsx`, and (for `no-unused-expressions`)
      `payment-front/pages/SubscriptionCheckoutPage.tsx`. Each blanket disable is a potential
      stale-closure bug — encode the intent with a ref or a correct dependency list instead.

- [ ] **Silence the 231 `no-explicit-any` warnings in test files.** Every remaining lint warning is
      an `any` inside a `*.test.ts(x)` file. Replace with precise mock/spy types (or `unknown` plus a
      narrowing assertion) so the warning count is signal rather than noise.

## Previously completed (kept for record)

- [x] **Fixed the duplicate-row upsert in `finance-service`'s ticker price writes.**
      `fetchAndSaveTickerPrices`/`fetchAndSaveLatestPrice` now normalize to the same UTC
      midnight boundary on both the upsert filter and the written document (via a shared
      `toUtcDateOnly` helper), matching what `alphaVantage.service.ts` already did correctly.
      Added a unique compound index `{ ticker: 1, date: 1 }` on `TickerPriceHistory` so the
      schema enforces the invariant. Regression tests assert the filter and update dates match.
- [x] **`file-service` returns 403, not 500, for a malformed signed-URL token** —
      `verifyToken` length-checks the token buffer before calling `timingSafeEqual`, so a
      wrong-length token is rejected like any other invalid token instead of raising
      `RangeError` for the middleware's catch block to turn into a 500.
- [x] **Dropped the `as RequestHandler` casts in `group-service/routes/groupRoutes.ts`** —
      `isInternalService`/`serviceIdentifier` moved from a local `InternalServiceRequest`
      subtype onto the global `Express.Request` augmentation (alongside `user`/`userGroups`
      from `@tumbaland/backend-core`), and both internal-auth middlewares are now explicitly
      typed `RequestHandler` with `void`-returning branches. Controllers and routes reference
      `Request` directly; no casts needed at the route-mounting call sites.
- [x] **Gated the two ungated `console.log`s in `@tumbaland/frontend-core`** —
      `monitoring/config.ts`'s `initMonitoring` now only logs its startup banner when
      `environment === 'development'`, matching the rest of the module.
- [x] **Aligned `express` versions** — `libs/backend-core` now declares `^5.2.1`, matching all
      eight services.
- [x] **Consistent graceful shutdown across all backend services** — `registerShutdown()` in
      `@tumbaland/backend-core`, adopted in all eight `src/index.ts`.
- [x] **Unified `/health` readiness check** — `createHealthCheck({ service, description,
checkDatabase? })` factory in backend-core, adopted by all eight services.
- [x] **Library errors routed through the monitoring layer** — the `console.error` sites in
      `libs/frontend-core`'s `authService.ts`/`groupService.ts` now use the monitoring `logger.error`.
- [x] **ESLint 10 / `@eslint/js` resolution** _(re-verified at `3aa19bb`)_ — `eslint .` runs to
      completion with 0 errors on a clean install. Earlier failures were a partial `node_modules`.
