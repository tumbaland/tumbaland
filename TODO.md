# TODO — Codebase Improvements

Snapshot from a repo-wide review on 2026-07-12 (v0.0.369). Ordered by priority within each
section. Overall state is healthy: shared libs (`core`, `frontend-core`, `components`) are
well-factored, `npm audit` is clean, CI is path-filtered, and every service sits on
`createBaseApp` with security headers, rate limiting, tracing, and metrics.

## Testing

- [ ] **Raise frontend test coverage.** Six of eight frontends have a single test file
      (`auth-front`, `group-front`, `payment-front`, `relationship-front`, `account-front`,
      `shell-front` — each just an `App.test.tsx` smoke test). The domain logic in their
      services/hooks is untested. Start with the apps that carry real logic:
      relationship-front (journal/checklist editor) and payment-front.
- [ ] **file-service and public-service have 1 test file each.** file-service in particular
      has untested HMAC/signed-URL logic (`src/utils/hmac.ts`, `signedUrlController.ts`) —
      that's security-sensitive and cheap to unit-test.
- [ ] **Add coverage thresholds.** No `coverageThreshold` in any jest config and no coverage
      gate in Vitest configs, so coverage can silently regress. Even a modest global floor
      (e.g. 60%) enforced in CI would hold the line.
- [ ] **No E2E tests.** There is no Playwright/Cypress anywhere. Note: a standalone `e2e/`
      Playwright package (login-page smoke + non-blocking CI job) was built in a session on
      2026-07-06 but **never committed** — it's absent from the working tree and all of git
      history, so it needs to be recreated. One smoke flow (login via auth-front →
      shell-front nav → one domain app CRUD) would catch cross-service integration breaks
      that unit tests can't.

## TypeScript

- [ ] **Re-enable `@typescript-eslint/no-explicit-any`.** It's `'off'` in
      `eslint.config.mjs:63` and there are ~240 non-test `any` usages. Concentrations:
      relationship-front (9 files), album-front (8), relationship-service (8),
      libs/core (8). Suggest flipping to `'warn'`, burning down the top offenders, then
      promoting to `'error'`.

## Frontend consistency

- [ ] **Normalize API-module location.** API clients live in `src/services/` in some apps,
      `src/config/` in others (finance, album, relationship), and relationship-front also
      has `src/api/`. Pick one convention (suggest `src/services/`).

## Docs

- [ ] **Add `docs/openapi.yml` to file-service.** It's the only service missing one; the
      other seven all ship an OpenAPI spec.
- [ ] **Add a root CLAUDE.md / AGENTS.md.** README.md is good but agent-oriented context
      (test commands per workspace, the app.ts/index.ts split, .env expectations) would
      speed up AI-assisted work. (One was written on 2026-07-06 but never committed — gone
      from the tree.)
