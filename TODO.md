# Code Improvement TODO

A prioritized list of improvements from analyzing the monorepo (`apps/backend/*`,
`apps/frontend/*`, `libs/*`). Overall the codebase is healthy: 322 test files for 465 sources,
no production `: any` or `as any` casts, `eslint .` reports 0 errors (231 warnings, all
`no-explicit-any` in test files), and the shared `createBaseApp`/`errorHandler`/`registerShutdown`/
`createHealthCheck` primitives are used consistently across all eight backend services. The items
below are the concrete gaps worth closing, most impactful first.

## Medium priority — maintainability / DRY

- [ ] **Split `relationship-service/src/services/statistics.service.ts` (899 lines — the largest
  file in the repo).** It exports six large aggregation functions (`getRelationshipStatistics`,
  `getMonthlyHours`, `getMonthlyStatistics`, `getMonthlyActivityBreakdown`, `getWeeklyHeatmapData`,
  `getCumulativeTimelineData`) that repeat similar Mongo `$match`/date-bucketing pipeline fragments.
  Extract shared pipeline builders and split into per-concern modules (e.g. `statistics/monthly.ts`,
  `statistics/heatmap.ts`, `statistics/timeline.ts`) for readability and easier testing.

- [ ] **De-duplicate the two album-front AI service clients.**
  `segmentationService.ts` (464 lines) and `objectDetectionService.ts` (381 lines) independently
  define near-identical scaffolding: their own `AIServiceError` class, a `HealthStatus` interface,
  and the same submit → poll-job → fetch-result lifecycle. Extract a shared
  `createAiServiceClient`/base module (one `AIServiceError`, one polling helper, one health check)
  and have both clients build on it, mirroring how the frontend already shares
  `@tumbaland/frontend-core`'s `createApiClient`.

- [ ] **Break up the largest frontend components.** `album-front/components/collage/CollageStage.tsx`
  (513) and `finance-front/components/TickerHistoryModal.tsx` (511) are the two biggest React files.
  Both mix data-fetching, layout, and interaction logic in a single component — extract custom hooks
  (e.g. a `useCollageStage`/`useTickerHistory` data hook) and presentational subcomponents to shrink
  the render body and make the units independently testable.

## Lower priority — code quality

- [ ] **Audit the `react-hooks/exhaustive-deps` suppressions (5 sites).**
  `finance-front/pages/PortfolioPlanner.tsx` (2×, both "run once when X changes" effects),
  `finance-front/components/planner/ProjectionSection.tsx`,
  `relationship-front/components/TotalDaysChart.tsx`, and (for
  `@typescript-eslint/no-unused-expressions`) `payment-front/pages/SubscriptionCheckoutPage.tsx`
  disable a lint rule. Each blanket disable is a potential stale-closure bug — verify the intent and
  encode it with a ref or a correct dependency list rather than suppressing the rule.

- [ ] **Silence the 231 `no-explicit-any` warnings in test files.** Every remaining lint warning is
  an `any` inside a `*.test.ts(x)` file (e.g. `libs/backend-core/src/utils/correlation.test.ts`,
  the `libs/frontend-core/src/monitoring/*.test.ts` suite). Replace with precise mock/spy types (or
  `unknown` + a narrowing assertion) so the warning count is a real signal again rather than noise.

## Tooling — resolved / verified

- [x] **ESLint 10 / `@eslint/js` resolution.** *(verified)* A clean `npm ci` install resolves
  `@eslint/js`'s exports map correctly; `eslint .` runs to completion with 0 errors. The earlier
  `Cannot find package '.../@eslint/js/index.js'` failure was a stale/partial `node_modules`, not a
  version mismatch — `@eslint/js ^10.0.1` and `eslint ^10.6.0` are compatible.

## Previously completed (kept for record)

- [x] **Consistent graceful shutdown across all backend services** — `registerShutdown()` in
  `@tumbaland/backend-core` (SIGINT + SIGTERM → cleanup → `server.close()` → `disconnectDB()`),
  adopted in all eight `src/index.ts`.
- [x] **Unified `/health` readiness check** — `createHealthCheck({ service, description,
  checkDatabase? })` factory in backend-core, adopted by all eight services; redundant per-service
  health modules removed.
- [x] **Library errors routed through the monitoring layer** — the eight `console.error` sites in
  `libs/frontend-core`'s `authService.ts`/`groupService.ts` now use the monitoring `logger.error`.
