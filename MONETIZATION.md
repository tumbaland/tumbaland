# Monetization Implementation Plan

Turning the existing Stripe integration into actual revenue. Companion to `TODO.md` — that file
tracks code health, this one tracks the paywall.

**Current state:** `payment-service` is complete (checkout, webhooks, idempotency, payment ledger,
admin plan CRUD). No other service reads subscription state. A grep for
`subscription|entitlement|quota|planCode|isPremium|tier` across all sixteen apps returns hits only
inside `payment-service` / `payment-front`. Paying today buys a row in Mongo and nothing else.

Stripe has only ever run against test data — there are no real customers, so nothing in this plan
carries a migration burden for existing paying users. Phase 4.4's grandfathering item is moot.

**Phases 0, 1 and 2 are done.** Phase 3's chokepoints are next.

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

## Architecture decision: a meter bills to the group owner, and `subjectId` is an email

`UsageMeter.subjectId` is an email, but **`Album.userId` and `TrackedTicker.userId` are not** — they
are `req.user.id`, which `authController` sets to the auth-service `User._id`. Anything that
attributes album or ticker rows to a meter has to join through the `users` collection first. Group
membership, by contrast, is already keyed by email. This is why the backfill needs a user map at all
and why nothing can be attributed from the album/finance collections alone.

**Pooled resources bill to the group owner**, not to the member who happened to create the row:

- Appendix A already sells Family storage as *"250 GB pooled"*. Pooled means one meter, and the only
  identity a group has is its owner.
- Chokepoint 5 (`seats`) charges the owner by construction — the owner is who bought the seats. If
  storage charged the uploader instead, a Family group would be a plan whose headline number nobody
  can actually spend: every shared upload would come out of the uploader's *personal* free 1 GB.
- It makes expansion revenue work the way the plan claims it does. A group is a thing one person pays
  for and several people use.

The owner is `members[].role === 'owner'` — that is what every authorization check in
`group-service/src/services/groupService.ts` tests, and `updateRole` can hand the role to someone
else, so the `createdBy` field goes stale. `createdBy` is the fallback when a group somehow has no
owner row.

**Soft-deleted groups still bill storage and tickers, but not seats.** The split is not arbitrary:
the bytes of a soft-deleted group's photos are still in MinIO and still cost money, and its tickers
are still fetched daily — `portfolioScheduler.service.ts` selects on `{ isActive: true }` and never
looks at group state. Its seats grant nobody access to anything, so charging for them would be
charging for nothing.

Two consequences for Phase 3, both new work that this decision creates:

- `album-service` and `finance-service` must resolve a group to its owner's email to pick the quota
  subject. Neither has a group-service client today; the JWT carries `groups` (ids) but no owner.
  `GET /groups/:id` already sits behind the internal-service token, so the client is the missing
  piece, and it wants the same short TTL cache as the entitlement client for the same reason.
- The `subject` resolver that `requireQuota` already takes is exactly the hook for this, which is
  why it exists.

**`trackedTickers` counts distinct active symbols per subject, not rows.** The unique index is
`{ ticker, userId, groupId }`, so one person can hold the same symbol personally *and* through a
group; the Alpha Vantage spend that the limit exists to recover is
`TrackedTicker.distinct('ticker', { isActive: true })`, one call per symbol per day no matter how
many rows point at it. Counting rows would bill for a cost that is not incurred.

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

Shipped dark, and still dark for a structural reason rather than a configured one: nothing calls the
enforcement middleware yet. 402s exist but no route can produce one until Phase 3 wires a
chokepoint. There is no mode switch — see the note below.

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
      cannot upload while well under their limit.

      Leave `finance-service`'s provider-quota usage intact — it solves a different problem (a
      deployment-wide external ceiling) and should keep its own model.

- [x] **Decided the group-storage ownership rule: the group owner pays.** Written up in the
      architecture note above, because it turned out to decide more than storage. It is not an edge
      case — *every* album and *every* tracked ticker in the live database belongs to one group, so
      this rule decides where 100% of current usage lands, and the alternative (bill the uploader)
      would have put 8.88 GB of shared photos against a personal 1 GB free tier while the Family
      plan's "250 GB pooled" stayed unspendable.

      The same rule settles the two meters that sit next to it: `seats` counts distinct people
      across the live groups a subject owns, and `trackedTickers` counts distinct active *symbols*
      rather than rows, because a symbol costs one Alpha Vantage call per day however many rows
      point at it.

- [x] **Backfill existing usage before enforcing — as a scheduled reconciliation, not a one-shot.**
      `libs/backend-core/src/entitlements/reconcile.ts`, run nightly at 03:30 by payment-service
      (`services/usageReconciliation.service.ts`) and on demand through
      `npm run reconcile:usage --workspace=payment-service` — dry-run by default, `--apply` to write,
      `--user=<email>` to scope it.

      **Why it can be recomputed at all, and why that makes a cron the right shape:** every meter it
      touches is *derived*. `storageBytes` is the sum of photo sizes, `trackedTickers` the count of
      distinct active symbols, `seats` the members of the groups a subject owns — in each case the
      underlying collection is the record and the counter is only a cache of it, kept hot because a
      quota check cannot afford the aggregation. So drift is always repairable, and the repair is
      cheap enough to run unattended.

      `aiJobs` is excluded, and its exclusion is the same rule read backwards: nothing but the
      counter records that a GPU job happened, so there is no truth to recompute it from. That is
      precisely why `consumeQuota` rolls its increment back on rejection — a leaked increment there
      is permanent, where on a derived meter it survives only until the next run.

      **Scheduled from payment-service** even though the source data belongs to album-, finance- and
      group-service: it is a billing concern, payment-service already owns entitlement truth, and
      every service shares one database so the reads are local wherever it runs. Splitting it across
      the three data owners would mean three partial jobs that can disagree.

      **It races live writes, deliberately.** A `consumeQuota` landing between the aggregation and
      the write is lost. That is tolerable for exactly the reason above — the next run re-derives the
      same number and converges — so it is scheduled at a quiet hour (well clear of finance-service's
      22:00 price update) rather than defended with a lock the codebase has no mechanism for.

      A run that corrects anything logs `entitlement.reconciled` at **`warn`**, not `info`: a
      correction means the counter *had* gone wrong and users were being metered against a wrong
      number until the job ran, so a recurring one is a leak in `consumeQuota`/`releaseQuota` worth
      chasing rather than routine housekeeping.

      **Reads the photos collection, not `Album.totalSize`.** The plan said to reuse
      `statisticsService`'s aggregation; that aggregation reads the denormalized counter, which is
      exactly the field a drifting `$inc` would have corrupted — reconciling against it would import
      the drift instead of correcting it. The script sums `photos.size` and *reports* any album
      whose counter disagrees. (At the time of writing: zero drift across 43 albums and 2566
      photos.)

      **Not recorded in `migrations` and not deleted after running**, unlike the one-shots in Phase
      0/1 — it is not a migration, and treating it as one would have thrown away the repair. Safe to
      re-run because it computes absolute values and writes only the meters that disagree, so a
      second run in a row is a verified no-op.

      Two rules it encodes deliberately:

      - It will **correct an existing meter down to zero**, but never *creates* a zero row — absence
        already reads as zero everywhere, so seeding zeros would be noise, while leaving a stale
        count alive would outlive the data it counted.
      - It **never deletes** a meter whose subject it no longer recognizes (a removed user, an
        ownership change). Those are printed for review. A reconciliation script that silently drops
        billing state is worse than the drift it fixes.

      Unattributable data — an album in a permanently-deleted group, a `userId` matching no user,
      photos pointing at a missing album — is billed to the uploader where one can still be
      identified and reported as `UNATTRIBUTED` where it cannot, rather than quietly vanishing from
      the totals.

      First run against the live database: `toomastahves@hotmail.com` → `storageBytes` 9539827715
      (8.88 GB), `trackedTickers` 6, `seats` 2; the other two accounts resolve to zero on every
      meter. Both maintainer accounts are on the `staff` plan, so nothing is near a ceiling.

---

## Phase 3 — Wire the chokepoints

- [x] **~~`ENTITLEMENTS_MODE` env var: `off` | `observe` | `enforce`.~~ Removed. Enforcement is
      unconditional.** Shipped with Phase 1, deleted before any chokepoint used it.

      The mode existed to buy a calibration period: run two weeks in `observe`, count
      `entitlement.would_block` per meter, and replace Appendix A's guesses with numbers. That
      premise does not hold here. The deployment has **three** user accounts, two of them maintainers
      on the `staff` plan with every meter at `-1` and the third holding no data at all. Two weeks of
      observation would have produced an empty log and the same guesses, at the cost of a
      three-valued switch on every gate — three branches per call site, a code path where enforcement
      is skipped entirely, and the standing risk that the paywall is silently off in production
      because a variable was unset. That is the same argument the architecture note above makes
      against an `ENTITLEMENTS_EXEMPT_EMAILS` allowlist, and it lands the same way.

      So the limits in Appendix A stay product judgement, which is what they were always going to be
      here, and the numbers move through `PUT /api/plans/:code/limits` at runtime — no deploy, no
      restart, which is precisely what makes a calibration *mode* unnecessary. The lever that decides
      whether a limit bites is now structural: whether a chokepoint calls it.

      What replaced it: every rejection logs a structured **`entitlement.blocked`** event — meter,
      subject, used, limit, plan, route, and whether the entitlement was a stale fallback — next to
      the 402 it throws. The 402 reaches the user; only this line reaches the operator. The `stale`
      flag is the one worth alerting on: a run of blocks against fallback limits means payment-service
      is down and paying users are being held to free, which is a different incident from a limit set
      too tight.

- [x] **Prerequisite: services can resolve a group to its owner.** Created by the ownership decision
      in Phase 2 — three of the six chokepoints bill a group's usage to its owner, and no service
      outside group-service could name that owner. The JWT carries `groups` (ids) and nothing else.

      - **`GET /internal/groups/:id/owner`** on group-service, behind `requireInternalServiceToken`,
        mounted at `/internal` **ahead of the rate limiter** for the same reason payment-service's
        entitlement route is: every chokepoint asks it from one container IP per service, so an
        IP-counted limiter would throttle deployment-wide enforcement — and since the client falls
        back to billing the caller, a 429 here would quietly bill the wrong person.

        Deliberately not `getOne`: this answers without the caller being a member (album-service asks
        on behalf of an uploader it is about to gate), and returns three scalars rather than the whole
        group document, which carries invite tokens.

      - **`libs/backend-core/src/groups/client.ts`** — `getGroupOwner`, `invalidateGroupOwner`,
        `clearGroupOwnerCache`. Same 60s TTL, 5000-entry bound and in-flight collapsing as the
        entitlement client. Neither a 404 nor a failure is cached: a 404 is nearly always a bad id and
        would spend a cache slot on garbage, and a cached failure would keep billing the wrong subject
        for a minute after recovery.

      - **`groups/subject.ts` → `groupOwnerSubject(req => req.body.groupId)`** plugs straight into the
        `subject` resolver `requireQuota` already accepts. Personal rows bill to the caller; group rows
        bill to the owner; an unresolvable owner bills the caller and logs at `error`. Refusing the
        write instead would be harsher than what the entitlement client does for the same class of
        outage, and the error direction is bounded in the shape that matters — the common case is a
        member on a cheap plan uploading into a group owned by someone on Family, so the fallback
        checks against the *smaller* allowance.

      - **Env wiring, which was missing entirely.** None of the consuming services received a payment
        URL, so the entitlement client shipped in Phase 1 would have logged "not configured" and
        failed every user closed to free the moment a chokepoint called it. Wired album, finance,
        group and relationship, plus `SERVICE_NAME` on all four so `x-service-id` and the metrics
        labels stop reading `unknown-service`.

      - **New: `GROUP_INTERNAL_URL` and `PAYMENT_INTERNAL_URL`, separate from the public
        `*_API_URL`.** `GROUP_API_URL` and `PAYMENT_API_URL` cannot be pointed at the container
        network, because the frontend entrypoints template those same variables into the
        `config.json` the **browser** downloads — album-front, finance-front and relationship-front
        for the group URL, payment-front for the payment one. One variable, two consumers with
        incompatible needs.

        Both clients now read `*_INTERNAL_URL` and fall back to the public variable, so local dev and
        any un-migrated deployment keep working — they just take the long way round, out through the
        proxy and back, carrying the internal service token across the public edge.

        **This also fixes a live defect unrelated to entitlements:** `.env.production` had
        `PAYMENT_API_URL=http://payment-service:5005`, which payment-front was handing to the browser
        as the base URL for the subscription and checkout pages. No browser can resolve a Docker
        service name. Corrected to the public hostname, with the internal address moved to
        `PAYMENT_INTERNAL_URL`. **Both new variables need setting as GitHub repo `vars`** —
        `deploy-all.yml` and `deploy-single-service.yml` now emit them into `.env.app`, and an unset
        var silently yields the fallback rather than an error.

- [ ] **Wire the six chokepoints:**

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

- [ ] **Review `entitlement.blocked` volume per meter once there are real users, and move the limits
      from data.** A meter that blocks a large share of free users is either priced wrong or is a bad
      paywall. `Plan.limits` is editable at runtime, so this is a `PUT /api/plans/:code/limits` and
      not a release — update Appendix A to match when you do it.

---

## Phase 4 — Make the meters visible

Gating without surfacing is indistinguishable from breakage — and since enforcement is unconditional,
Phase 3 lands *already blocking*. That makes this phase concurrent with Phase 3 rather than after it:
a chokepoint wired without the meter beside it is a feature that silently stops working.

### 4.1 Shared components — `@tumbaland/components`

- [x] **`<UsageMeter>`** — labelled bar, used/limit, colour ramp to amber past 80%, an upgrade CTA
      that appears only once the ceiling is in sight. One component, six placements.

      **Purely presentational — it takes numbers and never fetches them.** That is what lets the same
      component serve the album dashboard, the ticker list, the group member list and the pricing
      table without any of them having to agree on a data layer.

      An unlimited meter renders *no bar at all*, just its usage figure: a full bar would read as "at
      your limit" and an empty one implies a ceiling that does not exist. Both maintainer accounts
      are on `staff`, so this is the state the people running the product see every day — getting it
      wrong would have made the meter look broken to exactly the people who could notice.

      `formatBytes` here is binary (1 KB = 1024 B) to match `DEFAULT_PLAN_LIMITS`, which sets storage
      as `1 * GB` = 1073741824. Decimal formatting would render a 1 GB plan as "1.07 GB".

      Fed by two new pieces:

      - **`createEntitlementsService`** in `@tumbaland/frontend-core`, reading
        `GET /api/subscriptions/me/entitlements`. It restates the meter *keys* — a browser bundle
        cannot import backend-core, which pulls in mongoose — but **never the numbers**, which arrive
        from the API resolved by the same `normalizeLimits` the middleware enforces from. Duplicating
        keys costs a rename; duplicating limits would recreate the Phase 0 defect exactly.
        A response without `limits` is rejected rather than returned half-built, so the failure
        happens once, here, instead of at every call site's property access.
      - **`useEntitlements`** in `@tumbaland/components`, for the five fronts *without*
        `@tanstack/react-query` (account, group, payment, relationship, shell). album-front and
        finance-front have react-query and should use `useQuery`, which gives them caching this does
        not try to reimplement.

      **A failed lookup is never an error state.** The meter is decoration on a page that works
      without it, so payment-service being unreachable costs the bar, not the dashboard.
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

- [x] **album-front** — `components/dashboard/StorageChart.tsx` rendered usage with no denominator,
      under a comment asserting "there is no plan-level storage limit". Now carries the meter, the
      limit and a CTA into the shell's pricing route.

      **It meters `usage.storageBytes`, not the dashboard's own `totalStorage`.** The two differ
      whenever albums live in a group: the dashboard shows what this user can see, while the quota
      belongs to the group's owner and covers everything the group holds. Metering the visible figure
      would under-report how close the account is to being blocked — which, given every album in the
      live database is group-owned, would have been wrong for every real user.

      Needed `PAYMENT_API_URL` threaded through album-front's four config surfaces (ConfigProvider,
      `vite-env.d.ts`, `docker-entrypoint.sh`, `compose.yml`) — the front had no way to reach
      payment-service at all. The same wiring is the prerequisite for the remaining placements.
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

### 4.4 Rollout

- [ ] ~~**`ENTITLEMENTS_MODE=enforce`, one service at a time.**~~ There is no switch to flip. The
      rollout unit is the chokepoint, not the service: wiring one gate turns exactly that limit on,
      everywhere, immediately. Order them the same way regardless — start with finance, which has the
      smallest user overlap and the clearest value — and ship each gate together with its
      `<UsageMeter>` from 4.3, since a user who cannot see the ceiling experiences the 402 as a bug.
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
