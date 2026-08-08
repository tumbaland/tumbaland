# Monetization Implementation Plan

Turning the existing Stripe integration into actual revenue. Companion to `TODO.md` — that file
tracks code health, this one tracks the paywall.

**Current state:** `payment-service` is complete (checkout, webhooks, idempotency, payment ledger,
admin plan CRUD). No other service reads subscription state. A grep for
`subscription|entitlement|quota|planCode|isPremium|tier` across all sixteen apps returns hits only
inside `payment-service` / `payment-front`. Paying today buys a row in Mongo and nothing else.

Stripe has only ever run against test data — there are no real customers, so nothing in this plan
carries a migration burden for existing paying users. Phase 4.4's grandfathering item is moot.

**Phases 0 and 1 are done, plus Phase 2's meter store.** Phase 2's backfill is next.

Work top to bottom. Each phase is unsafe to start before the one above it lands.

**Before deploying any of Phase 1:** services install `@tumbaland/backend-core` from npm inside
their Dockerfile (see `scripts/sync-lib-versions.mjs`), so the entitlement code has to be released
— `npm run release --workspace=@tumbaland/backend-core` — before payment-service is rebuilt. Local
dev resolves the lib through the workspace symlink and needs nothing.

---

## Architecture decision: entitlements are NOT a JWT claim

The obvious move is to copy the `groups` claim pattern — embed `plan` in the JWT at sign time. **Do
not do this.** `auth-service/src/services/jwtService.ts` sets `JWT_EXPIRES_IN = '24h'`, and its own
comment states that `tokenVersion` revocation "is only enforced by auth-service's own auth
middleware — every other service just verifies the JWT signature/expiry and has no way to know a
token was revoked early."

For groups that's tolerable. For entitlements it produces both failure directions:

- A user upgrades and waits up to 24h for the feature they just paid for → support ticket.
- A user cancels or their card fails and keeps paid features for up to 24h → revenue leak.

Calling `/auth/internal/invalidate-tokens` on plan change doesn't fix it, because the services doing
the enforcement never check `tokenVersion`.

**Instead:** `payment-service` owns entitlement truth and exposes it over the existing internal
service-token channel. Services read it through a shared client in `@tumbaland/backend-core` with a
short in-process TTL cache. Enforcement points are writes and dispatches — low frequency — so a
60-second cache makes the network cost negligible while bounding staleness to one minute.

The frontend does **not** need a JWT claim either: `GET /api/subscriptions/me` already exists.

---

## Architecture decision: limits live in the database, not in a code table

The original 1.1 sketch put a `PLAN_LIMITS` table in code. That is wrong for the thing it describes.
A limit is a *commercial* dial — "is 50 GB the right number for €6" is a question answered by looking
at usage, repeatedly — and pinning it to a deploy guarantees it drifts from whatever the pricing page
says. So:

- **`Plan.limits` in Mongo is the authority.** Admin-editable at runtime through
  `PATCH /api/plans/:code` and `PUT /api/plans/:code/limits`, both already behind `requireAdmin`.
- **Code owns the vocabulary, not the values.** `libs/backend-core/src/entitlements/definitions.ts`
  holds the meter/feature *keys*, their units and periods, and `DEFAULT_PLAN_LIMITS`.
- **`normalizeLimits(stored, planCode)` merges the two**: stored values win, missing keys fall back
  to the plan's defaults, unknown keys are dropped. So a meter added in code works everywhere the
  moment it exists, with no Plan document backfill, and a typo in an admin form cannot invent a
  meter that nothing enforces.
- **Defaults are still the floor.** They are what an untouched plan resolves to and what the client
  falls back to when payment-service is unreachable — which is why `free`'s defaults must stay
  conservative.
- **`ENTITLEMENT_CATALOG`** (served at `GET /api/plans/catalog`) is the metadata an admin UI builds
  its form from: key, label, unit, period, description, plus the defaults and the `-1` sentinel. An
  admin front therefore needs no hardcoded meter names, and a new meter appears in the form by
  itself.

The pricing page reads `effectiveLimits` off the same `GET /api/plans` response the middleware
enforces from, which is what makes Phase 0's "stop advertising limits that don't exist" structural
rather than a promise.

---

## Architecture decision: three layers, and no exemption branch

Limits resolve through three stored, partial layers, each overriding the last:

1. **Code defaults** — `DEFAULT_PLAN_LIMITS`, the bootstrap and the outage fallback.
2. **`Plan.limits`** — what an admin sets for *everyone on a plan*.
3. **`EntitlementOverride`** — what an admin sets for *one person*.

`applyLimits(base, partial)` is the single step all three share, so the merge rules (unknown keys
dropped, missing keys inherited, negatives become `UNLIMITED`) cannot diverge between them.

**Two different tools, deliberately not merged:**

- A **comp grant** is an ordinary Subscription with `isComp: true` and no Stripe ids — "this person
  is on this plan and pays nothing". It shows in the UI as their plan.
- An **override** is a per-user adjustment on top of whatever plan they hold — "this friend gets
  20 GB instead of 1". Invisible; the plan is unchanged.

Using a comp grant for the second would distort subscription reporting; using an override for the
first would leave the account showing as free.

**Both are documents, not environment variables.** An `ENTITLEMENTS_EXEMPT_EMAILS` env allowlist is
the cheaper version of this and was rejected: it is invisible to the admin UI, needs a redeploy to
change, and — worst — creates a code path where enforcement is skipped entirely. The people running
the product would then never exercise the paywall and would never notice it was broken. A comp grant
runs the identical resolution, middleware and metering as a paying customer; the only difference is
that the numbers it resolves to are `-1`.

Every grant and override carries `grantedBy`, a `reason`, and an optional `expiresAt`. The expiry
matters: a temporary bump nobody remembers to revoke silently becomes permanent, and
`resolveEntitlements` filters both collections on it, so a lapsed grant stops granting on its own.

### The staff plan

`staff` is a real plan with `isPublic: false` — active, granting, and never for sale. It is excluded
from the public catalog and from `upgradeTo` targets, but `GET /api/plans` adds it back **for the
people who are on it**, so a staff account's pricing page shows their actual plan instead of
silently reading as free. A comp grant also outranks a paid subscription in `pickBest`, because the
staff plan is priced at zero and ranking purely by price would let any paid plan the same account
holds quietly beat an explicit admin grant.

Seeded, along with the maintainer grants, by a one-shot migration (`003-staff-plan-grants`) which
was then removed — the API is the durable interface: `POST /api/subscriptions/grants` for a comp
grant, `PUT /api/entitlement-overrides/:email` for a per-user adjustment. The `migrations`
collection retains both rows as the record that they ran.

---

## Phase 0 — Stop the bleeding ✅ SHIPPED

Two defects could charge a customer incorrectly. Nothing else in this document should start until
these ship. No new revenue from this phase; it removes liability.

- [x] **Cancel the old Stripe subscription when switching plans.**
      `payment-service/src/controllers/stripeController.ts` — `deactivateLowerPricedSubs()` set
      `status = 'canceled'` on the Mongo document and never called Stripe, so the Stripe
      subscription stayed live and kept invoicing. A user moving Pro → Elite was billed for both,
      indefinitely, while the database showed one active plan. (`deactivateHigherPricedSubs()`
      already called Stripe — only the upgrade path was affected.)

      Both helpers now go through a shared `cancelAtStripe()` that lives outside their outer
      `try/catch`, so a failure to cancel at Stripe logs distinctly from a failure to read a Plan
      document — one of those charges the customer money and the other does not.

- [x] **Add a `canceling` status so access survives the paid period.**
      `cancelSubscription` asked Stripe for `cancel_at_period_end: true` (correct) and then
      immediately set the local record to `canceled` with `canceledAt = now`.

      - `'canceling'` added to the `ISubscription` status enum and the schema enum.
      - `cancelSubscription` sets `status = 'canceling'` and `cancelAt`, leaving `canceledAt` unset.
      - `customer.subscription.deleted` flips `canceling` → `canceled` (already did, via its
        `status !== 'canceled'` guard — now covered by a test that pins the transition).
      - `invoice.payment_failed` no longer drags a `canceling` sub back into `past_due`; a
        subscription winding down fails its final renewal by design, and flipping it would
        silently un-cancel it.
      - Supersede queries share one `SUPERSEDABLE_STATUSES` constant that includes `'canceling'`.
        `getMySubscription` includes it and ranks it above `past_due`. `cancelSubscription`'s own
        lookup deliberately excludes it — that request has already been accepted.
      - Reactivating a `canceling` record via the free-plan shortcut clears `cancelAt`.
      - Entitlement resolution (Phase 1) must treat `canceling` as entitled.

      **Also changed, beyond the original item:** when Stripe rejects the cancel,
      `cancelSubscription` no longer marks the record canceled locally and returns 202. Stripe
      still holds a live subscription that keeps invoicing, so a local-only cancel revoked access
      *while continuing to charge* — strictly worse than the double-billing it was meant to soften.
      It now leaves the record untouched and returns **502 `STRIPE_CANCEL_FAILED`**, and
      `SubscriptionPage` surfaces that instead of throwing an unhandled rejection.

- [x] **Make the pricing page stop advertising limits that don't exist.**
      `PlansPage.tsx` built its comparison table from a local `featureMatrix` (5/100/1000 daily
      uploads, 0.5/50/500 GB storage, private content, 30d/1yr/full retention, AI tiers, 2/10
      collaborators) mapped onto plan codes by regex in `tierAlias()`. None of it was enforced
      anywhere.

      `featureMatrix` and `tierAlias` are deleted. Cards now render `plan.features` and
      `plan.description` from the Plan document, falling back to "No features listed for this plan
      yet." Also removed with them, since all three were regex-derived claims: the POPULAR badge,
      the "For starters / professionals / power users" subtitles, and the "Exclusive Award:
      TumbaBubu plush 🧸" line — if the plush is real, it belongs in that plan's `features` array
      where an admin controls it. Phase 4 replaces this with the shared entitlement definition.

- [x] **Backfill: audit existing subscriptions for the double-billing defect.**
      Done by inspection instead of a script — the whole database held one subscription, one
      payment and three plans, all belonging to the maintainer. No third-party customer was ever
      billed, so there was nothing to refund.

      Worth recording, because it is the defect this phase fixes, caught in the wild: the single
      subscription (`tumbapro`, Stripe `sub_1Rv2OkF75xQeeDGeUULGPsk9`, customer
      `cus_SqjsxjFxcPK03o`) was marked `canceled` locally on 2025-12-26 with `canceledAt` set and
      `cancelAt` absent — the signature of the old Stripe-failed fallback, which marked the record
      canceled locally while the Stripe subscription stayed live. Its one payment was a live-mode
      charge (`cs_live_…`, €9.00, 2025-08-11), not test mode. Confirmed already dead at Stripe.

      All three collections were then dropped and reseeded — see below.

- [x] **Reset the billing collections and seed the canonical plans.**
      `subscriptions`, `payments` and `plans` were deleted and three plans seeded on the codes
      Appendix B settles on. Ran as a one-shot migration which was then removed, per its purpose;
      the `migrations` collection retains a `001-reset-billing-data` row as the record that it
      happened. Recover the code from git history if a similar reset is ever needed.

      The old plan documents used ad-hoc codes (`free`, `tumbapro`, `tumbamax`) with
      implementation-flavoured feature strings (`uploads_daily_5`, `optimizer_advanced`,
      `mc_custom_distributions`) that nothing enforced. Since Phase 1 keys `PLAN_LIMITS` by exact
      code and resolves anything unknown to free, migrating those codes forward would have been
      more work than reseeding — and Appendix B's migration item is now satisfied.

      Seeded: `free` €0, `personal` €600/mo · €6000/yr, `family` €1200/mo · €12000/yr (cents).
      **`features` is empty on all three, deliberately** — nothing is enforced until Phase 4, and
      populating it now would recreate the exact defect this phase just removed from `PlansPage`.
      Phase 4.1 fills it from the shared entitlement definition. `stripePriceId` is unset on the
      paid plans, so paid checkout will 400 until it is set via
      `PATCH /api/plans/:code/stripe-prices`; the free plan works today via the free-plan shortcut.

---

## Phase 1 — Entitlement backbone ✅ SHIPPED

Shipped dark: `ENTITLEMENTS_MODE` defaults to `observe`, nothing calls the enforcement middleware
yet, and no user-visible behaviour changed. 402s exist but no route can produce one until Phase 3
wires a chokepoint.

### 1.1 Shared entitlement definitions ✅

- [x] **New: `libs/backend-core/src/entitlements/definitions.ts`** — the meter/feature key registry,
      `PlanLimits`, `DEFAULT_PLAN_LIMITS`, `resolveLimits`, `normalizeLimits`, `fitsWithin`,
      `ENTITLEMENT_CATALOG`. **Changed from the original plan:** the per-plan numbers live on the
      Plan document, not in a `PLAN_LIMITS` code table — see the architecture note above. What
      remains in code is the vocabulary and the bootstrap defaults.

      `resolveLimits` falling back to free on an unknown code is unchanged and deliberate: a typo'd
      or newly-added plan code must never silently grant unlimited.

- [x] **`Plan.limits` on the model, admin CRUD, catalog endpoint.** Not in the original plan; it is
      what "configurable" required.

      | Route | Who | What |
      |---|---|---|
      | `GET /api/plans` | any user | public plans + `effectiveLimits`, plus the caller's own hidden plan |
      | `GET /api/plans/all` | admin | all plans, inactive and non-public included |
      | `GET /api/plans/catalog` | admin | meter/feature vocabulary for an admin form |
      | `PATCH /api/plans/:code` | admin | name, description, prices, features, isActive, isPublic, limits |
      | `PUT /api/plans/:code/limits` | admin | limits only; merges by default, `?replace=true` to reset |
      | `GET /api/subscriptions/me/entitlements` | any user | own plan, limits **and live usage** |
      | `GET/POST /api/subscriptions/grants` · `DELETE /api/subscriptions/grants/:email` | admin | comp grants |
      | `GET/PUT/DELETE /api/entitlement-overrides/:email` | admin | per-user limit adjustments |

      Zod validation is strict on meter and feature keys, so an unknown key is a 400 naming it
      rather than a silently dropped field and a limit everyone believes is live.

      **All four plan documents now carry explicit limits**, written by a one-shot migration
      (`002-seed-plan-limits`) that was then removed, per its purpose. Not strictly required — an
      unset `limits` already resolves to the same numbers through the defaults — but it makes the
      values visible and diffable in the database, and every later admin edit is a diff against
      something concrete. Recover the script from git history if the numbers ever need resetting.

### 1.2 Entitlement endpoint on payment-service ✅

- [x] **`payment-service/src/services/entitlementService.ts` + `controllers/entitlementController.ts`**,
      mounted at `GET /internal/entitlements?email=` behind the internal-service-token middleware.
      Returns `{ email, planCode, status, limits, upgradeTo, isComp, hasOverride }`.

      `upgradeTo` was added beyond the original shape: it is the cheapest active plan priced above
      the current one, read from the database, so the 402 body can name a real upgrade target
      without any service hardcoding the plan ladder.

      Mounted **before** the rate limiter, alongside the Stripe webhook. Every service asks this
      route whether a user may write, from one container IP each; an IP-counted limiter would
      throttle deployment-wide enforcement, and since the client fails closed, a 429 here would read
      as "everyone is on the free plan".

      `past_due` counts as entitled during the grace period — see Phase 5 dunning. Cutting access
      the instant a card fails converts recoverable involuntary churn into real churn.

- [x] **Hardened the internal-token middleware.** `libs/backend-core/src/middleware/internalServiceAuth.ts`
      now holds `requireInternalServiceToken`, `internalServiceTokenBypass` and
      `allowUserOrInternalService`; group-service and auth-service re-export the shared versions.
      Comparison is `crypto.timingSafeEqual` on equal-length buffers, and the bypass verifies the
      token itself instead of treating the header's presence as authentication — the old behaviour
      made any route that forgot to mount the second middleware reachable with
      `x-internal-token: anything`.

### 1.3 Entitlement client in backend-core ✅

- [x] **`libs/backend-core/src/entitlements/client.ts`** — `getEntitlements`,
      `invalidateEntitlements`, `clearEntitlementsCache`. 60s TTL, bounded at 5000 entries with
      oldest-first eviction, concurrent callers for one email collapsed into a single request.

      Fail-closed on payment-service being unreachable: returns `resolveLimits(FALLBACK_PLAN)` with
      `stale: true` and logs at `error`. Fail-open would give the product away during an outage;
      fail-closed degrades paying users to free limits for at most 60 seconds. Neither is great —
      the correct mitigation is that reads are never gated, only writes, so the blast radius is
      "cannot upload for a minute", not "cannot use the app."

      **Fallbacks are never cached**, or an outage would pin a paying user to free limits for a full
      minute after it ended.

- [x] **`libs/backend-core/src/entitlements/middleware.ts`**

      ```ts
      requireEntitlement('cleanExport')                       // → 402 when the plan lacks the feature
      requireQuota('storageBytes', { amount: r => r.body.sizeBytes })  // → 402 when it would exceed
      retentionFloor(email)                                   // → Date | null, for $match filters
      loadEntitlements(req)                                   // request-scoped, one lookup per request
      ```

      `consumeQuota` is a service function rather than middleware (`entitlements/usage.ts`): the
      increment belongs at the point the resource actually comes into existence, inside the
      controller's own success path, not before it in the chain.

      Every middleware takes an optional `subject` resolver, for the group chokepoint where the
      quota belongs to the owner rather than the caller.

### 1.4 The 402 contract ✅

- [x] **`PaymentRequiredError` in `libs/backend-core/src/errors/HttpError.ts`**, and `HttpError`
      grew an optional `details` bag that `errorHandler` spreads into the body (before the envelope
      fields, so a stray key can't shadow `success`/`error`/`message`). Body shape as specified:

      ```json
      { "success": false, "code": "QUOTA_EXCEEDED", "message": "Limit reached for storageBytes",
        "meter": "storageBytes", "used": 1073741824, "limit": 1073741824,
        "planCode": "free", "upgradeTo": "personal" }
      ```

      Feature denials use the same envelope with `code: "FEATURE_NOT_IN_PLAN"` and a `feature` field.

### 1.5 Tests ✅

- [x] **`entitlements/usage.test.ts` runs against `mongodb-memory-server`, not mocks** — added as a
      devDependency of `backend-core`. The concurrency cases are the reason: twelve simultaneous
      `consumeQuota` calls against a limit of five admit exactly five, and the counter ends at five
      because every rejected reservation rolled its own increment back. None of that means anything
      against a mocked `$inc`.

      Covered: the boundary under concurrency, release-on-failure, release never going negative and
      never losing a concurrent release, month rollover, unlimited meters, email casing, all three
      modes, unknown plan code → free, `canceling` and `past_due` count as entitled, plan deleted
      under a live subscription → free rather than unlimited, payment-service unreachable, cache TTL
      and eviction, and the token middleware's rejection of a bogus internal token.

      Plus, for the override layers: a comp grant outranking a paid subscription, no upsell to a
      comped account, overrides layering over the plan without disturbing untouched meters, expiry
      filtering on both collections, and the pricing page showing a hidden plan to its holder and to
      nobody else.

### 1.6 Overrides — shipped alongside

- [x] **Comp grants and per-user overrides**, per the three-layer architecture note above:
      `EntitlementOverride` model, `isComp`/`grantedBy`/`grantReason`/`expiresAt` on `Subscription`,
      `Plan.isPublic`, admin endpoints for both, and `payment-front` rendering a granted plan as
      "Complimentary" with the Cancel button disabled.

- [x] **The maintainer accounts are on it.** `staff` plan created (all meters `-1`, retention `-1`,
      `isPublic: false`) and granted to `toomastahves@hotmail.com` and `violettrar@gmail.com`.
      Verified end-to-end against the live database: both resolve to unlimited on every meter, an
      unknown email still resolves to the free plan's limits.

      Applied as migrations `002-seed-plan-limits` and `003-staff-plan-grants`; both scripts were
      removed afterwards and both rows are in the `migrations` collection.

---

## Phase 2 — Per-user metering

- [x] **Generalized `finance-service/src/services/apiQuota.service.ts` into backend-core.** Shipped
      with Phase 1, because the enforcement middleware needs somewhere to read usage from.

      ```ts
      // libs/backend-core/src/entitlements/UsageMeter.ts
      { subjectId: string, meter: MeterKey, period: string, count: number }
      // period: 'ALL' for cumulative meters, 'YYYY-MM' for monthly
      // unique compound index on { subjectId, meter, period }
      ```

      `entitlements/usage.ts` exposes `getUsage`, `getUsageSnapshot`, `checkQuota`, `consumeQuota`,
      `releaseQuota`, `setUsage`. The `$inc`-then-check race reasoning carried over unchanged.

      **One semantic differs from the provider quota it generalizes:** a rejected reservation rolls
      its own increment back before throwing. The provider version leaves an over-limit count to sit
      until the day rolls over, which is harmless for a daily bucket. A per-user cumulative meter
      never rolls over, so a leaked increment is permanent and surfaces months later as a user who
      cannot upload while well under their limit. In `observe` mode the increment is deliberately
      *kept* — rolling it back would under-report exactly the users the limits are calibrated on.

      Leave `finance-service`'s provider-quota usage intact — it solves a different problem (a
      deployment-wide external ceiling) and should keep its own model.

- [ ] **Backfill existing usage before enforcing.** `storageBytes`, `trackedTickers` and `seats` are
      cumulative — they need seeding from current data or every existing user starts at zero and
      silently exceeds later. `album-service/src/services/statisticsService.ts` already aggregates
      `totalStorage` per user; reuse that aggregation as the backfill source. Script under
      `scripts/`, idempotent, runnable per-user.

- [ ] **Decide the group-storage ownership rule and write it down.** Photos in a group album count
      against *someone's* quota. Recommendation: the group owner's, since Family is the plan that
      sells seats. This needs deciding before the backfill, not after.

---

## Phase 3 — Observe mode

Deploy every enforcement point recording usage and logging what *would* have been blocked, blocking
nothing. Run two weeks. The proposed limits in Appendix A are guesses — this is how they stop being
guesses.

- [x] **`ENTITLEMENTS_MODE` env var: `off` | `observe` | `enforce`.** Shipped with Phase 1. Default
      `observe`; an invalid value warns once and falls back to observe; read per call so a restart
      with a new value is all it takes. In observe mode `requireQuota` / `requireEntitlement` /
      `consumeQuota` log a structured `entitlement.would_block` event with meter, used, limit, plan,
      route and whether the entitlement was a stale fallback, then continue.

      `retentionFloor` returns `null` outside `enforce`, so observe mode produces no data on the
      retention gate — that limit has to be set from product judgement rather than from
      `would_block` volume.

- [ ] **Wire the six chokepoints** (all in observe mode):

      | # | Chokepoint | Service | File | Check |
      |---|---|---|---|---|
      | 1 | Signed upload URL | album | `controllers/photoController.ts` → `getUploadSignedUrlRequest` | `requireQuota('storageBytes', size)` |
      | 2 | AI analysis dispatch | album | **does not exist yet — see 3.1** | `consumeQuota('aiJobs', 1)` |
      | 3 | Add tracked ticker | finance | `routes/trackedTicker.ts` → `POST /` | `requireQuota('trackedTickers', 1)` |
      | 4 | Ticker price history range | finance | `controllers/tickerPriceHistory.controller.ts` | `retentionFloor()` — **this is the planner gate, see 3.2** |
      | 5 | Add group member | group | `controllers/groupController.ts` | `requireQuota('seats', 1)` vs owner's plan |
      | 6 | Statistics + journal reads | relationship | `services/statistics.service.ts` | `retentionFloor()` as `$match` |

### 3.1 Prerequisite: AI analysis has no server-side chokepoint

**The browser calls the AI services directly.** `album-front`'s `SegmentationView.tsx` and
`ObjectDetectionView.tsx` call `segmentationService` / `objectDetectionService`, which talk straight
to ports 8001 and 8002. There is no proxy anywhere in `apps/backend` — a grep for the AI service
URLs across all eight services returns nothing. `album-service` only ever sees the *result*, via
`PUT /photos/:id/ai-analysis`.

So `aiJobs` cannot be metered until a dispatch path exists. Two options:

- [ ] **Preferred: add a dispatch endpoint to `album-service`** that consumes quota, then forwards
      to the AI service, and have the frontend call that instead of 8001/8002 directly. This also
      closes an existing hole — those AI services are currently reachable from any browser with no
      authentication at all, which is a standing abuse risk independent of monetization.
- [ ] Alternative: enforce inside the Python services against the entitlement endpoint. Cheaper to
      write, but puts billing logic outside the TypeScript monorepo and outside its test suite.

Metering at `PUT /photos/:id/ai-analysis` (result submission) is **not** a substitute — the GPU cost
is already spent by then, and a client that simply never submits results consumes unlimited compute
for free.

Until one of these lands, treat `aiJobs` as advertised-but-unenforced and **leave it off the pricing
page**. That is exactly the mistake Phase 0 is cleaning up.

### 3.2 The planner gate is the price-history range, not a planner endpoint

`PortfolioPlanner.tsx` computes everything client-side: `runFrontierSimulation` from
`utils/frontierSim.ts` over data pulled from the generic `useHoldings`, `useTrackedTickers`, and
`getTickerPriceHistory` hooks. `finance-service` has **no** planner or frontier route — a grep for
either term across the service returns nothing. A `<PaywallGate>` on that page is therefore
cosmetic; anyone can bypass it from devtools.

The real server-side handle is the data the simulation needs. `PortfolioPlanner` declares
`HISTORY_YEARS = 2` and the frontier's covariance estimate is meaningless without roughly that much
daily history. So:

- [ ] **Apply `retentionFloor()` to `getTickerPriceHistory`.** Free tier resolves to 90 days, which
      makes the frontier statistically useless without needing a bypassable client-side gate — the
      data simply isn't returned.
- [ ] **Have the planner detect a truncated range and render the upgrade state itself**, rather than
      silently producing a bad frontier from 90 days of closes. A wrong answer is worse than a
      locked feature.
- [ ] This means `retentionDays` gates the planner *and* the relationship history — one meter, two
      products. Simplifies the pricing story; note it in the landing-page copy.

This chokepoint also fixes a bug `TODO.md` already flags: `getTickerPriceHistory()` currently does
`find().sort()` with no filter, no projection, and no limit, loading the entire price-history
collection on every request. Adding a date floor is the same edit.

- [ ] **Gate on the signed-URL request, not on `createPhoto`.** Chokepoint 1 is the only place the
      file size is known *before* bytes are written. `createPhoto` runs after the client has already
      uploaded to MinIO — blocking there means you've paid the storage cost and then refused the
      record. `uploadSignedUrlSchema` in `album-service/src/validation/schemas.ts` needs a
      `sizeBytes` field, and the client must send it.

- [ ] **Decrement `storageBytes` on photo and album delete.** A cumulative meter that only counts up
      is a bug that surfaces as an angry support email six months in.

- [ ] **Chokepoint 6 needs the retention floor in one place, not six.**
      `relationship-service/src/services/statistics.service.ts` is 899 lines with six aggregation
      functions that each build their own `$match` and date bucketing. `TODO.md` already proposes
      splitting it. Do that split first, extract a shared pipeline builder, and apply the floor
      there — six hand-placed floors will drift.

- [ ] **After two weeks, review `entitlement.would_block` volume per meter and set the real limits.**
      A meter that would block a large share of free users is either priced wrong or is a bad
      paywall. Update Appendix A from data.

---

## Phase 4 — Enforce, and make the meters visible

Gating without surfacing is indistinguishable from breakage.

### 4.1 Shared components — `@tumbaland/components`

- [ ] **`<UsageMeter>`** — labelled bar, used/limit, colour ramp to amber past 80%. One component,
      six placements. Highest-converting item in this document: people upgrade when they can see the
      ceiling coming, not when they hit it.
- [ ] **`<PaywallGate>`** — wraps a locked feature, renders it blurred-but-visible behind an inline
      unlock card. Show the planner's real chart under the gate. Nobody pays for a feature they've
      never seen.
- [ ] **`<UpgradeDialog>`** — driven entirely by a 402 body, so it names the exact meter that
      blocked and the exact plan that lifts it.
- [ ] **`<PlanBadge>`** — into `shell-front/src/components/AccountMenu.tsx`.

### 4.2 402 handling in the API client

- [ ] **`libs/frontend-core/src/apiClient.ts`** — add an `onPaymentRequired?: (body) => void`
      option alongside the existing `onUnauthorized`, fired on `response.status === 402`. Wire it
      once per app's `ConfigProvider` to open `<UpgradeDialog>` and every frontend inherits upgrade
      prompts for free. `ApiError` already carries `status` and `body`, so callers that want to
      handle it locally still can.

### 4.3 Placements

- [ ] **album-front** — `components/dashboard/StorageChart.tsx` already renders usage with no
      denominator. Add the limit, the meter, the CTA. Smallest diff with real conversion impact in
      the plan.
- [ ] **finance-front** — meter on `components/investments/TickersTab.tsx`. On
      `pages/PortfolioPlanner.tsx`, render the upgrade state when the returned price history is
      shorter than `HISTORY_YEARS` demands (per 3.2) — not a wrapper gate, since the real
      enforcement is server-side on the data.
- [ ] **relationship-front** — when retention clips a chart, label it ("showing 90 of 540 days").
      A silently short chart reads as a bug; a labelled one reads as an upgrade.
- [ ] **group-front** — seat counter on the members list, gate the invite button at the cap.
- [ ] **payment-front `PlansPage`** — render the shared entitlement definition, monthly/annual
      toggle with the saving as a real number, mark the current plan, buttons that say what will
      happen ("Switch to Family", not "Subscribe").

### 4.4 Flip the switch

- [ ] **`ENTITLEMENTS_MODE=enforce`**, one service at a time, starting with finance (smallest user
      overlap, clearest value).
- [ ] ~~**Grandfather existing users onto Personal for 90 days and tell them plainly.**~~ Moot —
      Stripe has only ever handled test data, so there are no existing paying users to grandfather.
      Existing *free* users still get metered for the first time, so the "what happens when you hit
      a limit" copy in 5.1 is doing this job instead.

---

## Phase 5 — Commercial surface

### 5.1 The front page

`shell-front/src/routes/AppRoutes.tsx` has exactly one route: `/` renders `TodoCard`. There is no
landing page, no feature tour, and no pricing reachable without a Google login. Sign-up is
Google-only and auto-approving, so the *authenticated* funnel is frictionless — nothing feeds it.

- [ ] **New: `shell-front/src/pages/LandingPage.tsx`**, served at `/` for unauthenticated visitors;
      authenticated users keep the current dashboard. `ProtectedRoute` already exists in
      `@tumbaland/components` — this is the inverse branch.

      Sections, in order:

      1. **Hero** — one sentence on what Tumbaland is: *the shared record of a life — photos,
         money, and time, in one place, for one household.* Google sign-in button, and a secondary
         "See pricing" that scrolls rather than navigates.
      2. **The four products** — album, finance, relationship, groups. One screenshot each, one
         sentence of what it does, one of who it's for. Real screenshots from the running app, not
         illustrations.
      3. **Why it's one product** — the argument that beats four separate cheaper tools: groups.
         Shared albums, shared activity history, and shared finances across the same household,
         under one subscription.
      4. **How pricing works** — see below. This is the section this codebase currently lacks
         entirely, and it is the one the paywall depends on.
      5. **Pricing table** — the same three tiers, rendered from the same shared definition as
         `PlansPage`, with the monthly/annual toggle.
      6. **Trial CTA** — "Start 14 days of Family, no card."
      7. **Footer** — terms (`payment-front` already has a `TermsPage`), privacy, contact.

- [ ] **Write the paywall explanation honestly, and put it above the price table.** The single
      highest-trust thing a small paid product can do is explain its limits before charging. Three
      short paragraphs:

      - **What's free forever.** Name it concretely — 1 GB, 3 tickers, 90 days of history, full
        album and journal features. Not "generous free tier."
      - **What costs money and why.** Storage and AI analysis cost real money per photo. Market data
        has a hard external ceiling — Alpha Vantage's free tier is 25 calls/day *across the whole
        deployment*, so tracked tickers convert subscription revenue directly into the thing that
        makes the feature work. Say that. It reframes the limit as honest cost recovery rather than
        an arbitrary dial, and it is true.
      - **What happens when you hit a limit or stop paying.** Nothing is deleted. Reads stay open;
        only new writes are capped. Downgrading hides data, never destroys it. Cancelling keeps
        access to the end of the period you paid for. Every one of these is a specific fear that
        stops people subscribing to a small indie product, and Phase 0's `canceling` status plus
        "reads are never gated" makes all three true — so state them.

- [ ] **Show live meters in the pricing table for signed-in users.** "You're using 340 MB of 1 GB"
      next to the free column converts better than any copy.

- [ ] **Route + build considerations.** `/` must render without auth — check `ConfigProvider` and
      the shell's bootstrap don't assume a session. Keep it fast: no MUI-heavy hero, static assets,
      no data fetch above the fold beyond the plan definitions.

- [ ] **Basic SEO/meta.** Title, description, OG image. The nginx config needs to serve `/` to
      crawlers without a redirect to auth.

### 5.2 Billing self-service

- [ ] **Replace the custom cancel flow with Stripe's billing portal.** One endpoint returning a
      portal session. You inherit card updates, invoice history, dunning emails, and cancellation
      handling — and you delete the code path that currently contains Phase 0's second defect.
      Keep `PaymentsHistoryPage` as a read-only view of the local ledger.

- [ ] **Surface `past_due`.** The webhook sets it and no UI ever mentions it. Persistent banner with
      a fix-payment link, a defined grace period (recommend 7 days, entitled throughout), then
      downgrade to free. For most small subscription products involuntary churn is roughly a third
      of all churn and by far the cheapest to win back.

### 5.3 Annual billing

- [ ] **`Plan.stripePriceIdYearly`** alongside the existing `stripePriceId`. `priceYearlyCents`
      already exists on the model with a comment conceding it is *"informational unless you add a
      yearly Stripe price later."* Add `interval: 'month' | 'year'` to
      `createCheckoutSessionSchema`, select the price accordingly, and extend the admin
      `PATCH /:code/stripe-prices` route. Price annual at ten months.

---

## Phase 6 — Trial

- [ ] **14 days of Family on signup, no card**, via Stripe `trial_period_days`. Do not build this
      before Phase 4 — a trial of a product that gates nothing is indistinguishable from the
      product. It works precisely because the meters are already visible: someone who spends two
      weeks at 250 GB with a full planner and shared albums, then watches `<UsageMeter>` show what
      they're about to lose, converts far better than someone shown a pricing table on day one.
- [ ] **Trial-ending email at day 11** with actual usage numbers in it.

---

## Instrumentation

`backend-core` already has logger, metrics, and tracing. Point them at the funnel.

- [ ] **Meter saturation histogram** — share of free users at 50/80/100% of each limit. Tells you
      which paywall sells and which just annoys.
- [ ] **402 → checkout conversion, by meter.** A chokepoint that fires often and converts near zero
      is a limit set too tight on something people don't value. Loosen it.
- [ ] **Trial-to-paid rate, and which features trial users actually opened.** This is what confirms
      or refutes the assumption that finance is the willingness-to-pay engine.
- [ ] **Involuntary churn** — `invoice.payment_failed` events with no subsequent
      `invoice.payment_succeeded`. Everything recovered here is revenue already earned.
- [ ] **Alpha Vantage headroom vs. paid tracked tickers.** The one number where a product limit and
      an infrastructure limit are the same thing. When paid tickers approach the daily call ceiling,
      the data key must be upgraded *before* the next signup.

---

## Appendix A — Proposed limits

Starting values, and **only defaults** since Phase 1: they live in
`DEFAULT_PLAN_LIMITS` and are what a Plan document resolves to before an admin has edited it. The
authority is `Plan.limits` in Mongo. Update the numbers there, from Phase 3 data, without a deploy —
and update this table when you do, since it is still what the defaults ship as.

| Meter | `free` | `personal` €6/mo · €60/yr | `family` €12/mo · €120/yr |
|---|---|---|---|
| `storageBytes` | 1 GB | 50 GB | 250 GB pooled |
| `aiJobs` (per month) | 25 | 200 | 600 |
| `trackedTickers` | 3 | 25 | 100 |
| `seats` | 1 | 1 | 5 |
| `retentionDays` | 90 | unlimited | unlimited |
| `cleanExport` | ✗ (watermarked) | ✓ | ✓ |

`retentionDays` is doing the most work here: it gates the relationship history *and*, via the
price-history range, the portfolio planner. **The planner is the best paywall in the codebase** —
the most sophisticated thing built, an obvious commercial analogue, and locking it costs nothing in
goodwill because casual users never open it. Retention is also self-strengthening: someone with
eighteen months logged who can see ninety days has a reason to pay that grows every month they stay.

`aiJobs` is listed but **not sellable until 3.1 lands.** Keep it off the pricing page until there is
a server-side dispatch path to meter.

Album storage is deliberately *not* the primary paywall. People expect photo storage free from
Google; finance is where willingness to pay actually lives, and groups is where expansion revenue
lives.

## Appendix B — Plan codes

Existing plan documents use arbitrary codes matched by regex in `PlansPage.tsx`
(`/(^|-)starter|free/`, `/(pro)/`, `/(elite|max)/`). Phase 1 makes `PLAN_LIMITS` keyed by exact
code, so:

- [x] **Settle on exactly three codes — `free`, `personal`, `family` — and migrate existing `Plan`
      documents.** Done in Phase 0. The old codes (`free`, `tumbapro`, `tumbamax`) were dropped
      rather than mapped forward — there was one subscription in the database and it belonged to
      the maintainer, so a reseed was cheaper and left no rows on codes absent from `PLAN_LIMITS`.
      Any code not in `PLAN_LIMITS` still resolves to free, which remains the safe default for
      anything added later.
