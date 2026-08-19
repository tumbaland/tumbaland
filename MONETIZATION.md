# Monetization Implementation Plan

Turning the existing Stripe integration into actual revenue. Companion to `TODO.md` — that file
tracks code health, this one tracks the paywall.

**Current state (2026-08-20).** The entitlement backbone is finished and tested: plan limits resolve
from the database through a cached internal API, usage meters are recorded and reconciled nightly,
the 402 contract exists, `<UsageMeter>` is live on the album dashboard, the upload dialog and the
tracked-ticker list, and the landing page's prices and limits come from the API rather than from a
hardcoded table. **Three chokepoints are enforced**: retention clips price history, which makes
the portfolio planner a paid feature; the `trackedTickers` limit refuses a symbol past the plan's
ceiling on both paths that track one; and `storageBytes` now refuses an upload that would not fit,
at the signed-URL request, with the bytes handed back on delete. Seats still record without
enforcing, and the rest of the plans are identical. Stripe has only ever taken one live charge (the
maintainer's); there are no customers, so nothing here carries a migration burden.

Phases 0–2 are shipped, Phase 5.1's front page is largely built, and Phase 3 (chokepoints) with
Phase 4 (visibility) are the active work — concurrent, see Phase 4's preamble for why. Phase 0's
plan-switch defects were finished off separately, once a review found the downgrade direction had
never been covered.

**Read "Go-live gate" before charging anyone.** The things standing between here and a first real
customer are mostly *not* in Phases 3–6.

**Releasing:** services install `@tumbaland/backend-core` from npm inside their Dockerfile (see
`scripts/sync-lib-versions.mjs`), and the fronts install `@tumbaland/frontend-core` and
`@tumbaland/components` the same way. Any shared-lib change must be released before the consuming
service or front is rebuilt. Local dev resolves through the workspace symlink and needs nothing.

---

## Go-live gate

Assessed against the running system, not against this document's checkboxes.

The giveaway that used to head this list (checkout handing out paid plans for free against a live
Stripe key) is fixed, along with VAT collection; three chokepoints now enforce, storage included; and
the pricing table renders the limits the services actually hold people to. What remains before
charging: paid checkout is **closed** until Stripe prices exist, the legal surface is a stub with no
mechanisms behind it, and the tracked-ticker numbers on the pricing page cannot be delivered on the
current data key. The two subscription-switch defects that headed this list are fixed — see What's
built.

**Read the billing items more suspiciously than the entitlement ones.** Everything about entitlements
here was written while building it and matches the code. The Stripe half predates the code, and the
last two defects found there were found by reading `stripeController.ts`, not by reading this file,
which described those paths as settled.

### Tier 0 — do not charge anyone until these are done

- [ ] **The tracked-ticker limits cannot be delivered on the current data key.** Alpha Vantage's free
      tier is `DAILY_LIMIT = 25` calls *for the whole deployment*, and the daily job spends one per
      distinct active symbol. Appendix A sells 25 symbols on Personal and 100 on Family: the first
      Personal customer consumes the entire deployment's daily quota, and one Family customer needs
      four times it.

      Two ways out, and they are commercial, not technical: upgrade the data key before the first
      sale and price the plans against what it costs, or cut the advertised numbers to what 25
      calls/day actually supports. What is not available is selling either number as it stands.
      Instrumentation tracks the headroom afterwards; this is the decision that has to precede it.

- [ ] **Set `stripePriceId` on `personal` and `family`** via `PATCH /api/plans/:code/stripe-prices`.
      **Until this is done every paid plan returns 503** — which is the intended state, but it does
      mean paid checkout is closed rather than merely unfinished.

- [ ] **Stripe Tax must be enabled and an origin address registered in the dashboard.** Checkout
      passes `automatic_tax`, so until that is done Stripe rejects the session outright — deliberate,
      since silently selling untaxed is the worse failure. Register for **OSS** before the first
      non-domestic EU sale.

- [ ] **The legal surface, which is currently a stub.** `TermsPage.tsx` is 63 lines of boilerplate
      with no legal entity, no address, no contact, and "Taxes may apply." It says subscriptions are
      "non-refundable", which conflicts with the EU consumer right of withdrawal — 14 days for
      digital services unless the customer expressly waives it, which you must actually ask for. It
      also references a Privacy Policy that **does not exist as a page**; the landing footer links
      only to GitHub and `/payments/terms`. Needed: real Terms naming the seller, a Privacy Policy
      (GDPR — you hold photos, journals and financial data), a working contact route, and withdrawal
      terms that match what you actually do.

      **And the mechanisms the policy would promise do not exist.** auth-service has no account
      deletion and nothing exports a user's data, so erasure (Art. 17) and portability (Art. 20) are
      unimplemented. Publishing the policy first is worse than publishing neither: it converts a gap
      into a written commitment. Ship delete-my-account and an export alongside the page, not after
      it.

### Tier 1 — without these, the paywall is fiction

- [ ] **Release `@tumbaland/backend-core` and `@tumbaland/frontend-core` before their consumers are
      rebuilt.** The storage gate calls `recordUsage` and payment-service's plan route calls
      `optionalAuth`, both new backend-core exports; shell-front's pricing table calls
      `createPlansService`, a new frontend-core one. Services and fronts install the libs from npm
      inside their Dockerfile, so until the libs are published this work is written but not
      deployed.

- [ ] **Billing self-service, minus the part that already works** (5.2). Cancelling *is* built —
      `POST /api/subscriptions/cancel` and a button on `SubscriptionPage` — and this file used to
      claim otherwise. What a customer still cannot do alone is **update a card**, **find an
      invoice**, or understand why their subscription says `past_due`: the status renders as a bare
      chip label on their own page and nothing explains it or links to a fix. Each of those is a
      chargeback and a complaint, and both cost more than the subscription.

- [ ] **Nobody on the team has ever hit a paywall.** Both maintainers hold `staff`, every meter
      unlimited, so no one sees a meter fill, a bar turn amber, or a 402 in the wild. A single
      free-plan test account is the cheapest possible check that the gates read as prices rather than
      as bugs — which is the whole premise of Phase 4, currently untested by anyone who could notice
      it failing.

### Tier 2 — real value, but they can follow the first customer

- [ ] Annual billing (5.3). `priceYearlyCents` is set on both paid plans and cannot be bought.
- [ ] Trial (Phase 6). Worth far more now that meters are visible.
- [ ] The AI dispatch path (3.1). Also the standing security hole: the AI services take no auth at
      all today.
- [ ] Instrumentation. Cheap, and answers whether any of this converts.

---

## Architecture decisions

These still govern the unbuilt work. The reasoning is kept; the implementation narration is not.

### Entitlements are not a JWT claim

`JWT_EXPIRES_IN = '24h'`, and no service outside auth-service checks `tokenVersion` — its own comment
says so. A plan embedded in the token would be stale in both directions: an upgrade waits up to a day
for what was just paid for, and a cancellation keeps paid features for up to a day.

Instead payment-service owns entitlement truth and serves it at `GET /internal/entitlements?email=`
over the internal-service-token channel. Services read it through a client in `@tumbaland/backend-core`
with a 60-second in-process cache. Enforcement points are writes and dispatches — low frequency — so
the network cost is negligible while staleness is bounded to a minute.

The client **fails closed**: an unreachable payment-service degrades everyone to free limits rather
than giving the product away for the length of an outage. Fallbacks are never cached, so recovery is
immediate. The blast radius is bounded by design — reads are never gated, only writes — so the worst
case is "cannot upload for a minute", not "cannot use the app".

The internal routes on payment-service and group-service are both mounted **ahead of the rate
limiter**: every service asks them from one container IP each, so an IP-counted limiter would throttle
deployment-wide enforcement, and since the clients fail closed a 429 would read as "everyone is free".

### Limits live in the database, not in a code table

A limit is a *commercial* dial — "is 50 GB right for €6" is answered by looking at usage, repeatedly —
and pinning it to a deploy guarantees it drifts from the pricing page.

- **`Plan.limits` in Mongo is the authority**, admin-editable at runtime.
- **Code owns the vocabulary, not the values**: `libs/backend-core/src/entitlements/definitions.ts`
  holds the meter/feature keys, their units and periods, and `DEFAULT_PLAN_LIMITS`.
- **`normalizeLimits(stored, planCode)` merges the two.** Stored wins, missing keys fall back to
  defaults, unknown keys are dropped — so a meter added in code works everywhere immediately, and a
  typo in an admin form cannot invent a meter that nothing enforces.
- **Defaults are the floor**: what an untouched plan resolves to, and the outage fallback. That is why
  `free`'s defaults must stay conservative.
- An unknown plan code resolves to **free**, never unlimited.

### Three layers, and no exemption branch

Limits resolve through three stored, partial layers: code defaults → `Plan.limits` (everyone on a
plan) → `EntitlementOverride` (one person). `applyLimits(base, partial)` is the single merge step all
three share, so the rules cannot diverge.

Two deliberately unmerged tools:

- A **comp grant** is an ordinary Subscription with `isComp: true` and no Stripe ids — "this person is
  on this plan and pays nothing". It shows in the UI as their plan.
- An **override** adjusts limits for one person on top of whatever plan they hold. Invisible; the plan
  is unchanged.

Using a comp grant for the second would distort subscription reporting; using an override for the
first would leave the account showing as free.

**Both are documents, not environment variables.** An `ENTITLEMENTS_EXEMPT_EMAILS` allowlist was
rejected: invisible to the admin UI, needs a redeploy, and — worst — creates a path where enforcement
is skipped entirely, so the people running the product would never exercise the paywall and never
notice it was broken. Every grant and override carries `grantedBy`, a `reason`, and an optional
`expiresAt`; resolution filters on expiry, so a lapsed grant stops granting on its own.

`staff` is a real plan with `isPublic: false` — active, granting, never for sale, all meters `-1`. It
is excluded from the public catalog and from `upgradeTo` targets, but `GET /api/plans` adds it back
**for the people on it**, so a staff account's pricing page shows their actual plan. A comp grant also
outranks a paid subscription in `pickBest`, because staff is priced at zero and ranking purely by
price would let any paid plan quietly beat an explicit admin grant.

### A meter bills to the group owner, and `subjectId` is an email

`UsageMeter.subjectId` is an email, but **`Album.userId` and `TrackedTicker.userId` are not** — they
are `req.user.id`, the auth-service `User._id`. Anything attributing album or ticker rows to a meter
must join through the `users` collection first. Group membership is already keyed by email.

**Pooled resources bill to the group owner**, not the member who created the row: Appendix A sells
Family storage as *"250 GB pooled"*, and pooled means one meter. If storage charged the uploader, a
Family group would be a plan whose headline number nobody can spend — every shared upload would come
out of the uploader's personal free 1 GB. This is not an edge case: *every* album and *every* tracked
ticker in the live database belongs to one group.

The owner is `members[].role === 'owner'` — what every authorization check tests, and `updateRole` can
move it while `createdBy` goes stale. `createdBy` is the fallback.

**Soft-deleted groups still bill storage and tickers, but not seats.** The bytes are still in MinIO and
the tickers are still fetched daily (`portfolioScheduler` selects on `{ isActive: true }` and never
looks at group state). The seats grant nobody access, so charging for them charges for nothing.

**`trackedTickers` counts distinct active symbols, not rows.** The unique index is
`{ ticker, userId, groupId }`, so one person can hold a symbol personally *and* through a group, while
the Alpha Vantage spend the limit recovers is one call per symbol per day regardless.

`groupOwnerSubject(req => req.body.groupId)` is the resolver for this, plugging into the `subject`
option `requireQuota`/`requireEntitlement` already accept. When the owner cannot be resolved it bills
the caller and logs at `error` — harsher denial would exceed what the entitlement client does for the
same outage, and the common case (a member on a cheap plan uploading into a Family group) checks
against the *smaller* allowance.

### Enforcement is unconditional — there is no mode switch

`ENTITLEMENTS_MODE` (`off` | `observe` | `enforce`) shipped with Phase 1 and was **deleted before any
chokepoint used it**. It existed to buy a calibration period: run two weeks in `observe`, count
would-blocks, replace Appendix A's guesses with data. That premise does not hold with three accounts,
two of them maintainers on unlimited `staff`. Two weeks of observation would have produced an empty
log, at the cost of a three-valued branch on every gate and a code path where enforcement is skipped
entirely — the same argument that rejected the exemption allowlist above.

So Appendix A stays product judgement, and the numbers move at runtime through
`PUT /api/plans/:code/limits` — which is precisely what makes a calibration *mode* unnecessary. What
decides whether a limit bites is now structural: whether a chokepoint calls it.

Every rejection logs a structured **`entitlement.blocked`** event — meter, subject, used, limit, plan,
route, and whether the entitlement was a stale fallback — beside the 402 it throws. The 402 reaches
the user; only this line reaches the operator. The `stale` flag is the one to alert on: a run of
blocks against fallback limits means payment-service is down and paying users are being held to free,
a different incident from a limit set too tight.

### Derived meters can be reconciled; `aiJobs` cannot

`storageBytes`, `trackedTickers` and `seats` are all *derived* — the underlying collection is the
record and the counter is a cache of it, kept hot because a quota check cannot afford the aggregation.
So drift is always repairable, which is what makes a nightly job the right shape.

`aiJobs` is excluded, and the exclusion is the same rule backwards: nothing but the counter records
that a GPU job happened, so there is no truth to recompute from. That is why `consumeQuota` rolls its
increment back on rejection — a leaked increment there is permanent, where on a derived meter it
survives only until the next run.

---

## What's built

Compressed; the reasoning that still matters is in Architecture decisions above, and the rest is in
git.

**Phase 0 — billing defects (shipped).** `deactivateLowerPricedSubs` marked subscriptions canceled in
Mongo without calling Stripe, so a Pro → Elite switch billed both indefinitely; both helpers now share
a `cancelAtStripe()` that logs a failed Stripe cancel distinctly from a failed Plan read. A
`canceling` status was added so access survives the period already paid for, with
`invoice.payment_failed` no longer dragging a winding-down subscription back to `past_due`. When
Stripe rejects a cancel the record is now left untouched and the API returns **502
`STRIPE_CANCEL_FAILED`** — the old local-only cancel revoked access *while Stripe kept charging*.
`PlansPage`'s regex-derived `featureMatrix` (six limits nothing enforced) was deleted. The billing
collections were reset and reseeded on `free` / `personal` / `family`; migration rows `001`–`003`
record it. Only one live charge ever existed (€9.00, 2025-08-11, maintainer's, already dead at
Stripe), so no third party was ever mis-billed.

**Phase 1 — entitlement backbone (shipped).** `definitions.ts` (keys, `DEFAULT_PLAN_LIMITS`,
`resolveLimits`, `normalizeLimits`, `applyLimits`, `fitsWithin`, `ENTITLEMENT_CATALOG`);
`Plan.limits` with admin CRUD; the internal entitlement endpoint and its cached client;
`requireEntitlement` / `requireQuota` / `retentionFloor` / `loadEntitlements`; `PaymentRequiredError`
and the 402 body (`code`, `meter`, `used`, `limit`, `planCode`, `upgradeTo`); comp grants and
per-user overrides; the hidden `staff` plan granted to both maintainers. The internal-token middleware
was hardened to `timingSafeEqual`, and the bypass now verifies the token rather than treating the
header's presence as authentication — the old behaviour made any route that forgot the second
middleware reachable with `x-internal-token: anything`.

| Route | Who | What |
|---|---|---|
| `GET /api/plans` | any user | public plans + `effectiveLimits`, plus the caller's own hidden plan |
| `GET /api/plans/all` · `/catalog` | admin | every plan; meter vocabulary for an admin form |
| `PATCH /api/plans/:code` · `PUT /api/plans/:code/limits` | admin | plan fields; limits (merge, or `?replace=true`) |
| `GET /api/subscriptions/me/entitlements` | any user | own plan, limits **and live usage** |
| `GET/POST /api/subscriptions/grants` · `DELETE .../:email` | admin | comp grants |
| `GET/PUT/DELETE /api/entitlement-overrides/:email` | admin | per-user adjustments |
| `GET /internal/entitlements?email=` | services | entitlement truth |
| `GET /internal/groups/:id/owner` | services | the quota subject for anything pooled |

**Phase 2 — metering (shipped).** `UsageMeter` (`{ subjectId, meter, period, count }`, unique compound
index, `ALL` or `YYYY-MM`) and `usage.ts` (`getUsage`, `getUsageSnapshot`, `checkQuota`,
`consumeQuota`, `recordUsage`, `releaseQuota`, `setUsage`). `consumeQuota` increments then checks the
*post-increment* value, so the loser of a race is the one rejected, and rolls back before throwing.
Tested against `mongodb-memory-server`, not mocks — twelve concurrent calls against a limit of five
admit exactly five and the counter ends at five.

Reconciliation lives in `entitlements/reconcile.ts`, runs nightly at **03:30** from payment-service,
and is also a CLI (`npm run reconcile:usage --workspace=payment-service`, dry-run by default,
`--apply`, `--user=`). It reads `photos.size` rather than the denormalized `Album.totalSize` — that
counter is what a drifting `$inc` would have corrupted — and *reports* disagreement instead of
rewriting another service's field. It corrects an existing meter down to zero but never creates a zero
row, and never deletes a meter whose subject it no longer recognizes. It races live writes by design;
the next run converges, which is why it is scheduled at a quiet hour rather than locked. A run that
corrects anything logs `entitlement.reconciled` at `warn`, since a recurring correction is a leak in
`consumeQuota`/`releaseQuota` worth chasing.

First run: `toomastahves@hotmail.com` → 9539827715 B (8.88 GB), 6 tickers, 2 seats; everyone else zero.

**Phase 3 prerequisite — group ownership (shipped).** `GET /internal/groups/:id/owner`, the cached
`getGroupOwner` client (60s TTL, 5000-entry bound, in-flight collapsing, neither 404s nor failures
cached), and `groupOwnerSubject`. Also the env wiring that was missing entirely: none of the consuming
services received a payment URL, so the Phase 1 client would have failed every user closed to free the
moment a chokepoint called it. `GROUP_INTERNAL_URL` / `PAYMENT_INTERNAL_URL` were introduced because
the public `*_API_URL` variables are handed to the browser by the frontends and cannot be pointed
inward — which also fixed `PAYMENT_API_URL` being set to a Docker hostname that payment-front was
serving to browsers.

**Phase 4.1 / 4.3 — first visibility (shipped).** `<UsageMeter>` in `@tumbaland/components`: labelled
bar, amber past 80%, upgrade CTA only once the ceiling is in sight, and **no bar at all** for an
unlimited plan (a full bar reads as "at your limit", an empty one implies a ceiling that does not
exist — and both maintainers are on `staff`, so that is the state the people running the product see
daily). Purely presentational, so one component serves all six placements. Fed by
`createEntitlementsService` in `@tumbaland/frontend-core` — which restates the meter *keys*, since a
browser bundle cannot import backend-core, but **never the numbers** — and `useEntitlements` for the
five fronts without react-query. A failed lookup is never an error state: the meter is decoration on a
page that works without it.

Placed on album-front's dashboard, metering `usage.storageBytes` rather than the dashboard's own
`totalStorage`: those differ whenever albums live in a group, and since every album in the live
database is group-owned, metering the visible figure would under-report for every real user.

**Phase 3 — three chokepoints (shipped).** Retention (`retentionFloor` on `getTickerPriceHistory`,
resolved across the caller *and* the owners of the groups in scope, taking the most generous floor),
tracked tickers (`services/trackedTickerUsage.ts`) and storage (`services/storageUsage.ts`). Three
things generalize to the gates still unwired:

- **A quota that counts something other than rows belongs in a service, not in `requireQuota`.**
  `trackedTickers` counts distinct active symbols, so whether a write costs a slot is a database
  question a generic middleware cannot ask — and putting it in a service also covered the second
  creation path (`createHolding` tracks its ticker automatically). Storage is a service for the same
  shape of reason: the billing subject depends on the album's group, which the route has not loaded.
- **Reserve before the write, settle after it, and pick the primitive by what already exists.**
  Tickers use `consumeQuota` (atomic, so the loser of two concurrent adds at the ceiling is the one
  rejected) with rollback on a failed write, and release on delete/pause/rename/move once the
  collection shows the new state. Storage cannot: the gate runs at the signed-URL request, the only
  point where a file's size is known *before* its bytes exist, so the increment happens later at
  `createPhoto` via `recordUsage`, which never rejects — refusing there would decline a record for
  bytes already in MinIO. The overrun that buys is bounded and self-correcting: the *next* upload is
  refused.
- **A subject that was inferred rather than resolved is checked against but never written to.** An
  unreachable group-service bills the caller for the check (the conservative direction, and no
  harsher than what the entitlement client does for the same outage) but touches no meter — charging
  the wrong account is worse than a counter that lags, because every meter here is derived and
  reconciliation re-derives it nightly.

Each shipped with its meter and a 402 that names the limit: `utils/paywall.ts` in finance-front and
album-front renders the body into the error surface each page already had, since a 402 that reads as
"Failed to save" is indistinguishable from a bug. Both copies go away when `<UpgradeDialog>` (4.2)
lands.

**Phase 5.1 — the pricing table reads the API (shipped).** `shell-front/src/config/pricing.ts` held a
hardcoded `LIMIT_ROWS` of seven limits; the landing page now renders `GET /api/plans`, whose
`effectiveLimits` are resolved by the same `normalizeLimits` the middleware enforces from, so a card's
ceiling and the ceiling that produces a 402 are one value. What the file still owns is presentation —
taglines, which card is highlighted, how a number becomes a sentence — with an unknown plan falling
back to its own `description`, so an admin can add a plan without a frontend deploy.

Three things worth keeping:

- **`GET /api/plans` is now optionally authenticated** (`optionalAuth` in backend-core). A pricing
  table nobody can read without an account is worth nothing, and signing in only *adds* the hidden
  plan the caller is on. An expired token is treated as no token rather than as a 401 — refusing
  public data over a stale cookie breaks the page for exactly the people most likely to have one.
- **A failed catalog is a state, not a fallback.** The section says pricing is temporarily
  unavailable rather than rendering numbers of its own; the moment the page can invent a ceiling,
  the card and the middleware are two different claims again.
- **`aiJobs` and `cleanExport` are no longer advertised**, closing the open items in 3.0 and 3.1:
  neither has a chokepoint, so a number on the card was a claim nothing held the product to. The
  free-tier answer in the FAQ is derived from the free plan's own limits for the same reason — it
  used to spell them out in words.

**Phase 0 completed — one subscription per customer (shipped).** Phase 0 fixed double-billing in the
upgrade direction and left the mirror image live: `deactivateLowerPricedSubs` cancelled only the
subscriptions priced *below* the new one, so a Family customer moving to Personal activated the
cheaper subscription while Family, being dearer, kept invoicing. The price comparison was the bug.

- **A plan switch now changes the subscription the customer has, instead of selling another one.**
  `createCheckoutSession` detects a live Stripe subscription and swaps the price in place with
  `proration_behavior: 'create_prorations'`, returning `changed: true` and no checkout URL. One
  subscription exists at any time, and prorations settle the difference in whichever direction the
  switch runs — an upgrade is charged for the remainder of the period, a downgrade credits it. This
  removes the class of bug rather than the instance: there is no second subscription for a
  supersession rule to get wrong.
- **Supersession is no longer price-directional.** `supersedeOtherSubscriptions` replaces both
  `deactivateLowerPricedSubs` and `deactivateHigherPricedSubs`, winds a *paid* row down at period
  end rather than cancelling it outright, drops an `incomplete` one immediately (nothing was paid,
  so there is no period to protect), and **skips comp grants** — buying a plan used to consume a
  staff or friend grant, because a zero-priced grant is "lower priced" than everything.
- **Switching to free is a cancellation and now behaves like one.** It used to call
  `stripe.subscriptions.cancel()`: access gone on the click, the rest of a paid month forfeited,
  while the cancel button for the same intent kept the period. Both paths now set
  `cancel_at_period_end` and land on `canceling`.
- **A failed wind-down leaves the record untouched**, matching the user-facing cancel path. Marking
  it canceled locally while Stripe keeps charging is the "access revoked, billing alive" failure
  Phase 0 removed from one path and left in another.
- **`customer.subscription.updated` is handled**, which is what keeps the local record honest now
  that plan changes happen on the subscription rather than through a checkout — and is the event the
  billing portal (5.2) will speak through.

**Plan codes** are settled as `free` / `personal` / `family` (+ hidden `staff`). Old codes were
dropped rather than mapped forward; anything unknown resolves to free.

---

## Phase 3 — Wire the chokepoints

Three of the seven are wired (storage, tracked tickers, retention — see What's built). The rest:

- [ ] **Wire the remaining chokepoints:**

      | # | Chokepoint | Service | File | Check |
      |---|---|---|---|---|
      | 2 | AI analysis dispatch | album | **does not exist yet — see 3.1** | `consumeQuota('aiJobs', 1)` |
      | 5 | Add group member | group | `controllers/groupController.ts` | `requireQuota('seats', 1)` vs owner's plan |
      | 6 | Statistics + journal reads | relationship | `services/statistics.service.ts` | `retentionFloor()` as `$match` |
      | 7 | Clean export | album | **does not exist yet — see 3.0** | `requireEntitlement('cleanExport')` |

      **Recorded is not enforced** — `seats` still carries an accurate live number that nothing reads
      at a write. Until that gate lands, the free plan and Family differ in three respects: how far
      back price history reaches, how many symbols may be tracked, and how many bytes may be stored.

- [ ] **Decide the over-cap policy before wiring seats (5).** A five-member Family group downgrading
      to Personal is over its cap the moment the plan changes, and unlike storage there is no
      "already spent" reading of it — the members are still there, still in the group, every day.
      The only answer consistent with *"downgrading hides data, never destroys it"* is **enforce on
      add, never evict**: the group keeps its members, and the next invite is what gets refused.
      Write that down here rather than letting the middleware decide it by omission, because the
      other reading — dropping members at renewal — is the kind of thing a paying household never
      forgives.

- [ ] **Thumbnails are unmetered.** Reconciliation counts `photos.size` only, so a second counter for
      them would be corrected back every night. Real MinIO usage is understated by the thumbnail
      share — worth answering as a *limit* number in Appendix A rather than as another meter.

- [ ] **Chokepoint 6 needs the retention floor in one place, not six.**
      `relationship-service/src/services/statistics.service.ts` is 899 lines with six aggregation
      functions that each build their own `$match` and date bucketing. `TODO.md` already proposes
      splitting it. Do that split first, extract a shared pipeline builder, and apply the floor
      there — six hand-placed floors will drift.

- [ ] **Review `entitlement.blocked` volume per meter once there are real users, and move the limits
      from data.** A meter that blocks a large share of free users is either priced wrong or is a bad
      paywall. `Plan.limits` is editable at runtime, so this is a `PUT` and not a release — update
      Appendix A to match when you do it.

### 3.0 `cleanExport` has no chokepoint at all

Not one of the six, and that is an omission rather than a decision. `cleanExport` is a defined
`FeatureKey` and it is set on all four plans in `DEFAULT_PLAN_LIMITS`, while **no watermarking code
exists anywhere and nothing calls `requireEntitlement('cleanExport')`.** The pricing page used to
advertise *"Collage export, watermarked"* on the free tier, which was the Phase 0 defect returning —
a limit advertised and unenforced. That line is gone; the unenforceable feature flag is not.

It is also not straightforwardly fixable, for the same structural reason as the planner in 3.2:
collage export is entirely client-side. `components/collage/exportCollage.ts` renders the stage to a
canvas and downloads the blob; `album-service` has no export or download route. So:

- A `requireEntitlement('cleanExport')` gate has nothing to sit on, and a client-side `if` around the
  export button is bypassable from devtools.
- Unlike price history there is no server-side data handle to truncate either — the browser composes
  the collage from photos the user is already entitled to see.

Two honest options, and they should be chosen deliberately rather than drifted into:

- [ ] **Move export server-side** — album-service composes and returns the PNG, watermarking it when
      the plan lacks `cleanExport`. Real enforcement, and the only version that survives devtools.
      Costs an image pipeline the service does not currently have.
- [ ] **Accept it as a client-side courtesy** — watermark in the browser, and price the plans as
      though the feature is free. Honest only if the pricing page stops selling it as a paid line.

      The watermark line is **off the pricing page** as of the API-rendered pricing table —
      advertising it was the part with legal exposure, not the missing feature.

### 3.1 Prerequisite: AI analysis has no server-side chokepoint

**The browser calls the AI services directly.** `album-front`'s `SegmentationView.tsx` and
`ObjectDetectionView.tsx` talk straight to ports 8001 and 8002; there is no proxy anywhere in
`apps/backend`. `album-service` only ever sees the *result*, via `PUT /photos/:id/ai-analysis`.

So `aiJobs` cannot be metered until a dispatch path exists. Two options:

- [ ] **Preferred: add a dispatch endpoint to `album-service`** that consumes quota, then forwards to
      the AI service, and have the frontend call that instead of 8001/8002 directly. This also closes
      an existing hole — those AI services are reachable from any browser with no authentication at
      all, a standing abuse risk independent of monetization.
- [ ] Alternative: enforce inside the Python services against the entitlement endpoint. Cheaper to
      write, but puts billing logic outside the TypeScript monorepo and its test suite.

Metering at result submission is **not** a substitute — the GPU cost is already spent, and a client
that never submits results consumes unlimited compute for free.

Until one lands, `aiJobs` is advertised-but-unenforced, and it is **off the pricing page** as of the
API-rendered pricing table.

### 3.2 Standing hazard: a symbol is a foreign key

**A renamed ticker orphans its history, and nothing notices.** Price rows are keyed by ticker string
and reads are scoped to *currently tracked* symbols, so when the tracked tickers were re-added under
Alpha Vantage's exchange suffix in June 2026 (`VUSA.DE` → `VUSA.DEX`), 5,612 rows going back to 2015
became unreachable while the new symbols restarted from ~100 trading days. That, not retention, is
what left the live account with 203 days of history.
`scripts/migration/merge-renamed-ticker-history.js` re-keys the orphans (dry-run by default,
`--apply`), correcting the weekend-dated rows the daily job wrote between 2025-06-29 and the
`toUtcDateOnly` fix, never overwriting a row the live series already has. Run 2026-08-09: 5,339 rows
moved, restoring VUSA to 2015, VWCE to 2019 and XNAS to 2021.

The structural lesson is worth more than the repair: **a symbol is a foreign key, and the product has
no rename path.** Until one exists, re-adding a ticker under a new symbol silently costs the account
its history — and with `retentionDays` gating the planner, that reads to the user as a paywall.

### 3.2.1 Weekly history, and the sync surface

`TickerPriceHistory.interval` (`daily` | `weekly`) splits the two series that must never be read
together — a weekly return annualized as a daily one overstates the figure about fivefold. Uniqueness
moved to `{ ticker, interval, date }`; `scripts/migration/set-price-interval.js` stamps legacy rows
and creates that index, and `drop-stale-indexes.js` retires the old one. Both ran 2026-08-09: 6,433
rows stamped, index swapped.

`POST /ticker-price-history/fetch-weekly` and `npm run backfill:weekly --workspace=finance-service`
share one implementation. First backfill: 2,632 weekly closes across six symbols — H410 12.8 years,
VUSA 11.5, VGEU 11.4, VWCE 7.0, XNAS 5.5, EXUS 2.4 (genuinely young). The planner's shared window on
a weekly basis is **2.4 years / 128 observations**, against 150 days / 106 on the daily one.

`GET /ticker-price-history/coverage` reports rows, range and last update per interval per ticker, and
`<DataSyncDialog>` renders it. That endpoint exists because three states look identical on a short
chart and want different actions: *listed recently*, *the daily job stopped*, and *nobody ever
fetched history*. The last of those is the common one and is one click from fixed.

- [ ] **The planner still reads the daily series.** Choosing the basis with more observations, and
      annualizing weekly returns by 52 rather than 252, is the remaining step — the data is now
      there, the estimate does not yet use it.

---

## Phase 4 — Make the meters visible

Gating without surfacing is indistinguishable from breakage — and since enforcement is unconditional,
Phase 3 lands *already blocking*. This phase is concurrent with Phase 3, not after it: a chokepoint
wired without the meter beside it is a feature that silently stops working.

### 4.1 Shared components

`<UsageMeter>` and `useEntitlements` are done (see What's built). Remaining:

- [ ] **`<UpgradeDialog>`** — driven entirely by a 402 body, so it names the exact meter that blocked
      and the exact plan that lifts it. It also retires the two copies of `utils/paywall.ts` that
      finance-front and album-front carry today.
- [ ] **`<PlanBadge>`** — into `shell-front/src/components/AccountMenu.tsx`.

**`<PaywallGate>` is dropped, not deferred.** It was specified around the planner, and the planner
shipped something better: enforcement sits on the *data* — retention clips the history the simulation
needs — behind a notice that distinguishes a paywall from an instrument nobody has tracked long
enough. A blurred-chart wrapper has no remaining consumer, and every candidate for one is a read,
which this design never gates. Re-add it only alongside a named feature that is both genuinely gated
and worth showing through glass.

### 4.2 402 handling in the API client

- [ ] **`libs/frontend-core/src/apiClient.ts`** — add an `onPaymentRequired?: (body) => void` option
      alongside the existing `onUnauthorized`, fired on `response.status === 402`. Wire it once per
      app's `ConfigProvider` to open `<UpgradeDialog>` and every frontend inherits upgrade prompts for
      free. `ApiError` already carries `status` and `body`, so callers that want to handle it locally
      still can.

### 4.3 Placements

album-front (dashboard chart, upload dialog) and finance-front (tickers tab, planner) are done.
Remaining:

- [ ] **relationship-front** — when retention clips a chart, label it ("showing 90 of 540 days"). A
      silently short chart reads as a bug; a labelled one reads as an upgrade.
- [ ] **group-front** — seat counter on the members list, gate the invite button at the cap.
- [ ] **payment-front `PlansPage`** — render limits from the API, monthly/annual toggle with the
      saving as a real number, mark the current plan, buttons that say what will happen ("Switch to
      Family", not "Subscribe").

Each front needs `PAYMENT_API_URL` threaded through its four config surfaces (ConfigProvider,
`vite-env.d.ts`, `docker-entrypoint.sh`, `compose.yml`) plus its `.env.example` for local dev — album,
finance and shell fronts now have all five. The deploy workflows already write `PAYMENT_API_URL` into
`.env.app`, so a front that declares it in `compose.yml` picks it up with no pipeline change.

### 4.4 Rollout

- [ ] There is no switch to flip. The rollout unit is the **chokepoint**: wiring one gate turns that
      limit on, everywhere, immediately. Order them as Tier 1 above, and ship each gate together with
      its meter — a user who cannot see the ceiling experiences the 402 as a bug.
      Grandfathering is moot — there are no existing paying users. Existing *free* users still get
      metered for the first time, so the "what happens when you hit a limit" copy in 5.1 is doing
      that job instead.

---

## Phase 5 — Commercial surface

### 5.1 The front page

**Largely built.** `shell-front` has `LandingPage`, `HeroSection`, `PricingTable` and `LandingFooter`,
and `/` branches on auth — signed-out visitors get the landing page, signed-in users the dashboard.
Remaining:

The honest-limits explanation shipped as `FaqSection`, deliberately *below* the price table rather
than above it: as three paragraphs it asked a stranger to read about our GPU bill before they knew
what the product was, and as questions it answers the same things at the moment someone is weighing
the cost. The free tier's figures come from the free plan's own limits, so the answer cannot drift
from what is enforced. Remaining:

- [ ] **Make the FAQ's remaining promise true before charging.** *"You keep everything you paid for
      until the end of the period you paid for"* is now true on every path. *"Nothing you already
      saved disappears"* still has no seats policy behind it — Phase 3 above — and the copy is what
      turns that from an intention into a promise.

- [ ] **Show live meters in the pricing table for signed-in users.** "You're using 340 MB of 1 GB"
      next to the free column converts better than any copy. `<UsageMeter>` and the entitlements
      service now exist for exactly this.
- [ ] **Privacy Policy, contact route, and real Terms** (see Tier 0). The footer currently links only
      to GitHub and `/payments/terms`.
- [ ] **Basic SEO/meta.** Title, description, OG image; nginx must serve `/` to crawlers without an
      auth redirect.

### 5.2 Billing self-service

- [ ] **Replace the custom cancel flow with Stripe's billing portal.** One endpoint returning a portal
      session. You inherit card updates, invoice history, dunning emails and cancellation handling —
      and delete the code path that held Phase 0's second defect. Keep `PaymentsHistoryPage` as a
      read-only view of the local ledger.

      **It does not absolve the switch logic.** Which of a user's subscriptions supersede which is
      ours no matter who renders the cancel button, and that is precisely where both Tier 0 billing
      defects live. Fix those first; the portal is a convenience layer over a model that has to be
      right underneath it.
- [ ] **Surface `past_due`.** The webhook sets it, and the only place it reaches a user is as a bare
      chip label on their own subscription page — the word, with no explanation and nothing to click.
      Needed: a persistent banner with a fix-payment link, a defined grace period (recommend 7 days,
      entitled throughout), then downgrade to free. Involuntary churn is roughly a third of all churn
      for small subscription products, and by far the cheapest to win back.

      **The dunning emails are Stripe's, and that is the only reason this is affordable.** There is
      no transactional email anywhere in the backend — no provider, no templates, no send path — so
      anything this product wants to say on its own (see Phase 6) needs that built first. Leaning on
      Stripe for card-expiry and retry notices is the cheap half; do not let the plan assume the
      other half exists.

- [ ] **Persist the webhook idempotency guard, or delete it.** `webhookEventStore` is an in-memory
      `Set`: it does not survive a restart and is not shared between replicas, so a Stripe retry
      landing after a deploy is reprocessed. The real defence today is that the handlers are mostly
      idempotent — status assignments, and a ledger insert deduped on `invoiceId` — which is worth
      either backing with a persisted store or documenting as the actual contract. What it must not
      stay is a guard that reads as stronger than it is.

### 5.3 Annual billing

- [ ] **`Plan.stripePriceIdYearly`** alongside `stripePriceId`. `priceYearlyCents` already exists and
      is currently informational. Add `interval: 'month' | 'year'` to `createCheckoutSessionSchema`,
      select the price accordingly, and extend `PATCH /:code/stripe-prices`. Price annual at ten
      months.

---

## Phase 6 — Trial

- [ ] **14 days of Family on signup, no card**, via Stripe `trial_period_days`. Do not build before
      Phase 4 — a trial of a product that gates nothing is indistinguishable from the product. It
      works precisely because the meters are visible: someone who spends two weeks at 250 GB with a
      full planner and shared albums, then watches `<UsageMeter>` show what they're about to lose,
      converts far better than someone shown a pricing table on day one.
- [ ] **Trial-ending email at day 11** with actual usage numbers in it. **Blocked on infrastructure
      that does not exist**: there is no transactional email provider, template or send path anywhere
      in the backend, so this is "choose a provider, wire it, then write one email" — not a
      three-line job on top of the trial. Stripe's own trial-ending notice is free and covers the
      billing fact; what it cannot say is *you are storing 180 GB and about to keep 1*.

---

## Instrumentation

`backend-core` already has logger, metrics and tracing. Point them at the funnel.

- [ ] **Meter saturation histogram** — share of free users at 50/80/100% of each limit. Tells you
      which paywall sells and which just annoys.
- [ ] **402 → checkout conversion, by meter.** A chokepoint that fires often and converts near zero is
      a limit set too tight on something people don't value. Loosen it.
- [ ] **Trial-to-paid rate**, and which features trial users actually opened — confirms or refutes the
      assumption that finance is the willingness-to-pay engine.
- [ ] **Involuntary churn** — `invoice.payment_failed` with no subsequent `invoice.payment_succeeded`.
      Everything recovered here is revenue already earned.
- [ ] **Alpha Vantage headroom vs. paid tracked tickers.** The one number where a product limit and an
      infrastructure limit are the same thing: when paid tickers approach the daily call ceiling, the
      data key must be upgraded *before* the next signup. This is the *ongoing* watch; the advertised
      numbers already exceed the free key's whole daily quota, which is a Tier 0 decision above.

---

## Appendix A — Limits

These are the **code defaults** in `DEFAULT_PLAN_LIMITS` — what a Plan resolves to before an admin
edits it, and the outage fallback. The authority is `Plan.limits` in Mongo; change numbers there
without a deploy, and update this table when you do.

| Meter | `free` | `personal` €6/mo · €60/yr | `family` €12/mo · €120/yr |
|---|---|---|---|
| `storageBytes` | 1 GB | 50 GB | 250 GB pooled |
| `aiJobs` (per month) | 25 | 200 | 600 |
| `trackedTickers` | 3 | 25 ⚠ | 100 ⚠ |
| `seats` | 1 | 1 | 5 |
| `retentionDays` | 90 | unlimited | unlimited |
| `cleanExport` | ✗ (nothing watermarks) | ✓ | ✓ |

`retentionDays` does the most work: it gates the relationship history *and*, via the price-history
range, the portfolio planner. **The planner is the best paywall in the codebase** — the most
sophisticated thing built, an obvious commercial analogue, and locking it costs nothing in goodwill
because casual users never open it. Retention is also self-strengthening: someone with eighteen months
logged who can see ninety days has a reason to pay that grows every month they stay.

⚠ **`trackedTickers` is priced above what the deployment can serve.** The daily job spends one Alpha
Vantage call per distinct active symbol against a free-tier ceiling of 25 *for the whole deployment*,
so Personal's 25 is one customer's worth of the entire quota and Family's 100 is four customers'
worth of it. Either number has to move, or the data key does, before the first sale — see Tier 0.
The live account tracks six symbols, which is why nothing has broken yet.

`aiJobs` is listed but **not sellable until 3.1 lands**, and `cleanExport` is **not enforceable at all
today** — see 3.0. Neither is advertised any more: the API-rendered pricing table omits both.

Album storage is deliberately *not* the primary paywall. People expect photo storage free from Google;
finance is where willingness to pay lives, and groups is where expansion revenue lives.
