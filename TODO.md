# Code Improvement TODO

A prioritized list of improvements found while analyzing the monorepo (`apps/backend/*`,
`apps/frontend/*`, `libs/*`). The codebase is generally healthy — strong test coverage
(~323 test files for ~466 sources), no `: any`, shared `createBaseApp`/`errorHandler` used
consistently. The items below are the concrete gaps worth closing, most impactful first.

## High priority — reliability

- [ ] **Consistent graceful shutdown across all backend services.**
  Only `finance-service` and `relationship-service` register a `SIGINT` handler that calls
  `disconnectDB()`; the other six (`album`, `auth`, `file`, `group`, `payment`, `public`) exit
  without draining the Mongo connection. **No service handles `SIGTERM`** — which is the signal
  Docker/Kubernetes actually send on stop/rollout — so every service is force-killed on deploy.
  - Add a shared `bootstrapService({ serviceName, port, onReady? })` / `registerShutdown()`
    helper in `@tumbaland/backend-core` that wires `SIGINT` **and** `SIGTERM` →
    `server.close()` → `disconnectDB()` → `process.exit(0)`, and adopt it in every
    `src/index.ts`. This also removes the dotenv/`connectDB`/`requireEnv`/`app.listen`
    boilerplate duplicated in all eight bootstrap files.

## Medium priority — maintainability / DRY

- [ ] **De-duplicate the per-service `healthController`.**
  `@tumbaland/backend-core` already exports `healthCheck` and `healthLive`, yet 7 services each
  ship their own `controllers/healthController.ts` in 3+ divergent shapes (10–37 lines, 7
  distinct file hashes). Consolidate onto the shared implementation (parameterize the
  service-name/description) and delete the local copies + their tests, or document why a service
  must diverge.

- [ ] **Split `relationship-service/src/services/statistics.service.ts` (899 lines).**
  It exports six large aggregation functions (`getRelationshipStatistics`, `getMonthlyHours`,
  `getMonthlyStatistics`, `getMonthlyActivityBreakdown`, `getWeeklyHeatmapData`,
  `getCumulativeTimelineData`) that repeat similar Mongo `$match`/date-bucketing pipeline
  fragments. Extract shared pipeline builders and split into per-concern modules
  (e.g. `statistics/monthly.ts`, `statistics/heatmap.ts`, `statistics/timeline.ts`) for
  readability and easier testing.

## Lower priority — code quality

- [ ] **Route library-level errors through the monitoring layer instead of `console`.**
  `libs/frontend-core/src/authService.ts` (6×) and `groupService.ts` (2×) call `console.error`
  directly even though the repo has a monitoring layer (`captureException`/`logger`). Swap these
  for the monitoring API so library errors are captured consistently.
  (`public-service/logController.ts`'s `console.log` is intentional log forwarding — leave it.)

- [ ] **Audit the `react-hooks/exhaustive-deps` suppressions (5 sites).**
  `finance-front/pages/PortfolioPlanner.tsx` (2×), `finance-front/components/planner/ProjectionSection.tsx`,
  `relationship-front/components/TotalDaysChart.tsx`, and
  `payment-front/pages/SubscriptionCheckoutPage.tsx` disable the rule. Each is a potential
  stale-closure bug — verify the intent (usually "run once when X changes") and encode it with a
  ref or a correct dependency list rather than a blanket disable.

## Tooling — verify

- [ ] **Confirm the ESLint 10 / `@eslint/js` resolution.**
  A fresh checkout failed `npx eslint .` with
  `Cannot find package '.../@eslint/js/index.js'` (the installed `@eslint/js` exposes an exports
  map, not `index.js`). Confirm CI's `npm ci` produces a lockfile-consistent install and that
  `eslint.config.mjs`'s import resolves there; pin/align the `@eslint/js` ↔ `eslint` versions if
  the mismatch is real rather than environment-only.
