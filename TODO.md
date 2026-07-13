# Tumbaland — Improvement TODO

Evaluated 2026-07-13 (v0.0.378, main). Overall state: healthy. Strict TypeScript everywhere,
90% coverage thresholds enforced per workspace, change-detection CI matrix with a validation
script, shared `backend-core`/`frontend-core`/`components` libraries adopted by all 16 apps,
`createApiClient` now rolled out to all 8 frontends, typed error hierarchy + zod validation
everywhere, `npm audit` clean, zero TODO/FIXME comments in source, per-package release tags
fixed. The items below are the gaps that remain.

## High priority

- [ ] **Fix the remaining env-dependent 401-redirect tests.** `relationship-front`,
      `payment-front`, and `group-front` have the same "redirects to the auth front on a 401"
      test that failed in CI for finance-front (fixed 2026-07-13): the assertion depends on
      `AUTH_FRONT_URL` from `.env`, which is gitignored and absent in CI, so `onUnauthorized`
      silently no-ops and the test fails. Apply the same fix as
      `finance-front/src/services/financeApi.test.ts` — `vi.mock` the app's ConfigProvider
      module at the top of the test (account-front already does this).
- [ ] **Add end-to-end tests.** ~270 unit/integration test files but zero Playwright/Cypress
      specs. Nothing exercises a real cross-service flow (Google login → cookie mint →
      shell-front → domain app → backend CRUD). Unit mocks can't catch CORS, cookie-domain,
      or service-URL misconfigurations — exactly the class of bug this architecture
      (8 frontends × 8 backends, cookie auth across subdomains) produces. Start with one
      smoke spec per frontend against `npm run dev`.
- [ ] **Burn down `any` in production source.** ~258 occurrences across 67 files outside
      tests/dist. Enable `@typescript-eslint/no-explicit-any: error` in `eslint.config.mjs`
      once cleaned, so it can't creep back.
- [ ] **Replace raw `console.*` with the shared logger.** 30 call sites in production source
      while backend-core's logger and frontend-core's monitoring layer exist precisely for
      this. Add the `no-console` ESLint rule after the sweep.
- [ ] **Standardize frontend data fetching.** Only `album-front` and `finance-front` use
      React Query; the other six hand-roll `useEffect` + local state. Pick React Query as the
      standard, extract shared query hooks (`useCurrentUser`, `useTenant`) into
      `@tumbaland/frontend-core`, and migrate one app per sitting.

## Medium priority

- [ ] **Consolidate duplicated auth UI across frontends.** `ProtectedRoute.tsx` exists in
      7 copies and `AuthHeader.tsx` in 5 copies across `apps/frontend/*`. Same consolidation
      play as `createApiClient`/`createConfigProvider`: move a configurable version into
      `@tumbaland/components` and delete the copies.
- [ ] **Decompose oversized modules.** The finance calculators were refactored (good), but
      the worst offender is now backend:
      `relationship-service/src/services/statistics.service.ts` (847 lines). Also
      `album-front/.../CollageStage.tsx` (513), `finance-front/.../TickerHistoryModal.tsx`
      (511), `album-service/src/services/albumService.ts` (478). Extract calculation logic
      into plain testable modules; 500+-line files are where the next regression hides.
- [ ] **Add automated dependency updates.** No Dependabot/Renovate config in `.github/`.
      Audit is clean and drift is currently minor (eslint 10.6→10.7, helmet 8.2→8.3), but
      with ~19 workspaces manual updates won't keep pace. Renovate with grouped monorepo
      presets fits this layout well.
- [ ] **Extract the repeated controller authorization preamble.** The
      `req.user! / req.userGroups / groupId membership check` block recurs across ~145 call
      sites in backend services. A `requireGroupAccess(req, groupId)` helper in backend-core
      would shrink every controller and make the 403 behavior uniform.
- [ ] **Verify CORS covers account-front (port 3007).** CORS origins come from the
      `CORS_ORIGIN` env var per deployment (`backend-core/src/middleware/corsMiddleware.ts`),
      so this can't be confirmed from source. Known gap from the MUI 9 migration — check the
      deployed env values for each backend service.

## Low priority

- [ ] **Add an architecture doc for the infra stack.** `apps/infra` carries 18 subsystems
      (vault, consul, traefik, jaeger, ELK, prometheus…) with no top-level doc explaining
      which are actually deployed vs. experimental, or how a service gets wired into them.
- [ ] **Document group-membership propagation latency.** The "membership changes take up to
      30m + 5m verify-cache to propagate" behavior belongs in the README's architecture
      section, not just code comments.
- [ ] **Add a root CLAUDE.md / AGENTS.md.** The README is good; a short agent-facing doc
      (build/test commands per workspace, port table, test-infra gotchas like the uuid ESM
      mock and jsdom localStorage) would make AI-assisted sessions faster and safer.
