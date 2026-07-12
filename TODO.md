# Tumbaland — Improvement TODO

Evaluated 2026-07-12 (v0.0.375, main). Overall state: healthy. Strict TypeScript everywhere,
90% coverage thresholds enforced per workspace, change-detection CI matrix with a validation
script, shared `backend-core`/`frontend-core`/`components` libraries adopted by all 16 apps,
typed error hierarchy + zod validation rolled out, `npm audit` clean, secrets gitignored.
The items below are the gaps that remain.

## High priority

- [ ] **Add end-to-end tests.** There are 264 unit/integration test files but zero Playwright/
      Cypress specs. Nothing exercises a real cross-service flow (Google login → cookie mint →
      shell-front → domain app → backend CRUD). Unit mocks can't catch CORS, cookie-domain, or
      service-URL misconfigurations — which is exactly the class of bug this architecture
      (8 frontends × 8 backends, cookie auth across subdomains) produces. Start with one smoke
      spec per frontend against `npm run dev`.
- [ ] **Burn down `any` in production source.** ~240 occurrences outside tests, clustered in
      `libs/backend-core` (8 files), `relationship-service` (8), `album-service` (7). Enable
      `@typescript-eslint/no-explicit-any: error` in `eslint.config.mjs` once cleaned, so it
      can't creep back.
- [ ] **Replace raw `console.*` with the shared logger.** 31 call sites in production source
      while `@tumbaland/components`' monitoring layer and backend-core's logger exist precisely
      for this. Add the `no-console` ESLint rule after the sweep.
- [ ] **Standardize frontend data fetching.** Only `album-front` and `finance-front` use React
      Query; the other six hand-roll `useEffect` + local state (see the comment in
      `finance-front/src/components/AuthHeader.tsx` acknowledging the split). Pick React Query
      as the standard, extract shared query hooks (`useCurrentUser`, `useTenant`) into
      `@tumbaland/frontend-core`, and migrate one app per sitting.

## Medium priority

- [ ] **Decompose oversized components.** Worst offenders: `finance-front/src/pages/
      StockGrowthCalculator.tsx` (696 lines), `PortfolioOptimizer.tsx` (632),
      `album-front/src/components/collage/CollageStage.tsx` (513), `TickerHistoryModal.tsx`
      (511). Extract calculation logic into plain testable modules and split render trees;
      500+-line components are where the next regression hides.
- [x] **Fix the versioning scheme.** Done 2026-07-13. Root and the three published libs
      (`backend-core`, `frontend-core`, `components`) were all tagging under the same bare `v*`
      namespace — a real collision risk, not just noisy history (confirmed `backend-core` and
      `components` had drifted further still: versions published to npm with no matching
      `CHANGELOG.md` or tag at all, from hand-editing `version` and running `npm publish`
      directly instead of `npm run release`). Fixed: each package now has its own `tagPrefix`
      (`app-v`, `backend-core-v`, `frontend-core-v`, `components-v`); `changelog.yml`'s
      delete-and-repush hack (which was masking an unguarded race between concurrent runs) is
      replaced with a `concurrency` group so overlapping pushes queue instead of colliding.
      Process now documented in the root README's "Commits & Releases" section.
- [ ] **Add automated dependency updates.** No Dependabot/Renovate config in `.github/`.
      Audit is clean today, but with ~19 workspaces manual updates won't keep pace. Renovate
      with grouped monorepo presets fits this layout well.
- [ ] **Verify CORS covers account-front (port 3007).** Known gap from the MUI 9 migration:
      account-front was added later and its origin may be missing from `CORS_ORIGIN` in the
      per-service `.env` files / deployed config.
- [ ] **Remove hardcoded `localhost` fallbacks in backend source.** 6 occurrences in
      `apps/backend/*/src` outside tests; route them through the same config/env pattern
      backend-core already provides (`requireEnv`).

## Low priority

- [ ] **Document the auth token-revocation tradeoff where operators will find it.** The 30m
      JWT expiry + tokenVersion design is well-commented in `jwtService.ts`, but the constraint
      ("group membership changes take up to 30m + 5m verify-cache to propagate to other
      services") belongs in the README's architecture section too.
- [ ] **Add an architecture doc for the infra stack.** `apps/infra` carries 18 subsystems
      (vault, consul, traefik, jaeger, ELK, prometheus…) with no top-level doc explaining
      which are actually deployed vs. experimental, or how a service gets wired into them.
- [ ] **Extract the repeated controller authorization preamble.** The
      `req.user! / req.userGroups / groupId membership check` block recurs across ~120 call
      sites in backend services. A `requireGroupAccess(req, groupId)` helper in backend-core
      would shrink every controller and make the 403 behavior uniform.
- [ ] **Add a root CLAUDE.md / AGENTS.md.** The README is good; a short agent-facing doc
      (build/test commands per workspace, port table, test-infra gotchas like the uuid ESM
      mock and jsdom localStorage) would make AI-assisted sessions faster and safer.

---

## Engineer skill assessment

**Level: solid mid-to-senior full-stack engineer with strong platform instincts.**

What the codebase evidences well:

- **Architecture & code organization.** The monorepo is genuinely well-factored: three shared
  libraries with clear ownership boundaries, a uniform `routes → controllers → services →
  models` stack across 8 services, and factories (`createBaseApp`, `createApiClient`,
  `createConfigProvider`) instead of copy-paste. This is above-average discipline for a solo
  project.
- **Engineering hygiene.** Strict TS with `noImplicitReturns`/`noImplicitOverride`, enforced
  90% coverage thresholds, conventional commits, a CI matrix that *validates its own
  completeness* — that last one is a senior-level touch most teams don't have.
- **Judgment under tradeoffs.** The comment in `jwtService.ts` explaining why token revocation
  is only enforced at auth-service and how the 30m expiry bounds the exposure window shows the
  engineer reasons about security tradeoffs explicitly rather than cargo-culting.

Where to grow — in priority order:

1. **Testing above the unit level.** The coverage push was executed thoroughly, but it's all
   mocked-boundary testing. The skill gap is *test strategy*: knowing that in a 16-app
   cookie-auth microfrontend system, the highest-risk failures live in the seams (CORS,
   cookies, service discovery), and that one E2E smoke suite buys more safety than the next
   10% of unit coverage. Learn Playwright; practice writing the minimal spec that would have
   caught a past production bug.
2. **Type rigor at the edges.** Strict mode is on, but ~240 `any`s mean unknown data (API
   responses, Mongoose results, event payloads) is being waved through at exactly the points
   types matter most. Practice `unknown` + narrowing, and typing Mongoose models properly
   (`HydratedDocument`, lean result types).
3. **Frontend architecture consistency.** Backend patterns were consolidated aggressively
   (auth, errors, validation), but the frontends still diverge on the most consequential
   choice — data fetching/caching. Apply the same consolidation instinct to the frontend:
   pick one state-management approach and enforce it via the shared library.
4. **Release engineering.** The tag-deletion workaround in the changelog workflow and the dual
   version streams suggest versioning was patched until it stopped erroring rather than
   designed. Worth studying how monorepos handle releases (changesets, release-please) —
   immutable tags, one version authority.
5. **Component-scale discipline.** Backend files stay small; frontend pages grow to 600+
   lines. The instinct to extract exists (it happened in libs) — apply it before a component
   crosses ~250 lines, not after.

The trajectory in the git history (unify tsconfigs → extract backend-core → error handling →
validation → coverage) shows systematic, sequenced improvement rather than random churn.
The same sequencing applied to the five items above would close most of the gap to senior+.
