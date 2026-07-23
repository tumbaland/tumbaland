# Code Improvement TODO

A prioritized list of improvements found while analyzing the monorepo (`apps/backend/*`,
`apps/frontend/*`, `libs/*`). The codebase is generally healthy — strong test coverage
(~323 test files for ~466 sources), no `: any`, shared `createBaseApp`/`errorHandler` used
consistently. The items below are the concrete gaps worth closing, most impactful first.

## High priority — reliability

- [x] **Consistent graceful shutdown across all backend services.** *(done)*
  Added `registerShutdown()` to `@tumbaland/backend-core` (wires `SIGINT` **and** `SIGTERM` →
  optional cleanup hook → `server.close()` → `disconnectDB()` → exit, with an idempotency guard
  and a force-exit safety timer) and adopted it in all eight `src/index.ts` files. `file`/`public`
  opt out of the DB disconnect. Previously only `finance` and `relationship` had ad-hoc `SIGINT`
  handlers and no service handled `SIGTERM` — the signal Docker/Kubernetes send on rollout.

## Medium priority — maintainability / DRY

- [x] **Unify the health check across all services onto one standard.** *(done)*
  Added a `createHealthCheck({ service, description, checkDatabase? })` factory to
  `@tumbaland/backend-core` as the single `/health` readiness handler, and moved **all eight**
  services onto it. `checkDatabase: false` covers the one DB-less service (`public`). Removed the
  three redundant local health-service modules (`album`/`finance` `healthService`,
  `relationship` `health.service`) and their tests; per-service controller tests now smoke-test the
  wiring (100% coverage on each `healthController`). Documented the standard in backend-core's
  README.

- [ ] **Split `relationship-service/src/services/statistics.service.ts` (899 lines).**
  It exports six large aggregation functions (`getRelationshipStatistics`, `getMonthlyHours`,
  `getMonthlyStatistics`, `getMonthlyActivityBreakdown`, `getWeeklyHeatmapData`,
  `getCumulativeTimelineData`) that repeat similar Mongo `$match`/date-bucketing pipeline
  fragments. Extract shared pipeline builders and split into per-concern modules
  (e.g. `statistics/monthly.ts`, `statistics/heatmap.ts`, `statistics/timeline.ts`) for
  readability and easier testing.

## Lower priority — code quality

- [x] **Route library-level errors through the monitoring layer instead of `console`.** *(done)*
  Swapped the eight `console.error` call sites in `libs/frontend-core/src/authService.ts` and
  `groupService.ts` for the monitoring `logger.error` (feeds `captureException`/`captureMessage`),
  and updated the tests to assert on the logger. (`public-service/logController.ts`'s `console.log`
  is intentional log forwarding — left as-is.)

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
