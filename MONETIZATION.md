# Monetization Implementation Plan

Turning the existing Stripe integration into actual revenue. Companion to `TODO.md` — that file
tracks code health, this one tracks the paywall.

**Current state (2026-08-09).** The entitlement backbone is finished and tested: plan limits resolve
from the database through a cached internal API, usage meters are recorded and reconciled nightly,
the 402 contract exists, and `<UsageMeter>` is live on the album dashboard and the tracked-ticker
list. **Two chokepoints are enforced**: retention clips price history, which makes the portfolio
planner a paid feature, and the `trackedTickers` limit now refuses a symbol past the plan's ceiling —
on both paths that track one. Storage and seats still record without enforcing, and the rest of the
plans are identical. Stripe has only ever taken one live charge (the maintainer's); there are no
customers, so nothing here carries a migration burden.

Phases 0–2 are shipped. Phase 3 (chokepoints) and Phase 4 (visibility) are the active work, and are
concurrent — see Phase 4's preamble for why.

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
Stripe key) is fixed, along with VAT collection, and two chokepoints now enforce. What remains before
charging: paid checkout is **closed** until Stripe prices exist, the legal surface is a stub, and
storage — the biggest number on the pricing page — is still unenforced.

### Tier 0 — do not charge anyone until these are done

- [x] **Fixed the free-plan shortcut in `createCheckoutSession`.** The condition read
      `if (!plan.priceMonthlyCents || plan.priceMonthlyCents === 0 || !plan.stripePriceId)` and, on a
      match, created an **`active`** subscription with `renewsAt` a month out and no Stripe involved.
      Since no plan in the database carries a `stripePriceId` until an admin sets one, any signed-in
      user could `POST /api/subscriptions/checkout-session {"planCode":"family"}` and receive Family,
      free, renewing. The route is behind `authenticate` and nothing else. It also made the
      `!priceId` guard below it dead code.

      A plan is now free because **its price is zero**, never because its Stripe wiring is missing. A
      priced plan with no `stripePriceId` is refused **before anything is created**, with a `503` and
      an error log naming the plan — 503 rather than 400 because the fault is the deployment's, not
      the caller's, and the checkout page already renders the message in an error alert.

      A test previously pinned the old behaviour as intended, comment and all; it now asserts the
      refusal, alongside one proving a genuinely zero-priced plan is still free even if it carries a
      leftover price id.

- [ ] **Set `stripePriceId` on `personal` and `family`** via `PATCH /api/plans/:code/stripe-prices`.
      **Until this is done every paid plan returns 503** — which is the intended state, but it does
      mean paid checkout is closed rather than merely unfinished.

- [x] **VAT collected at checkout.** The session now passes `automatic_tax: { enabled: true }`,
      `billing_address_collection: 'required'` (Stripe Tax computes from the address, so it cannot be
      optional) and `tax_id_collection: { enabled: true }` so a business can be reverse-charged.
      Subscription-mode sessions already produce invoices, so the receipt trail needs nothing extra.

      **Requires Stripe Tax to be enabled and an origin address registered in the dashboard** — until
      then Stripe rejects the session outright. That is deliberate: silently selling untaxed is the
      worse failure. Still yours to do outside the code: register for **OSS** before the first
      non-domestic EU sale.

- [ ] **The legal surface, which is currently a stub.** `TermsPage.tsx` is 63 lines of boilerplate
      with no legal entity, no address, no contact, and "Taxes may apply." It says subscriptions are
      "non-refundable", which conflicts with the EU consumer right of withdrawal — 14 days for
      digital services unless the customer expressly waives it, which you must actually ask for. It
      also references a Privacy Policy that **does not exist as a page**; the landing footer links
      only to GitHub and `/payments/terms`. Needed: real Terms naming the seller, a Privacy Policy
      (GDPR — you hold photos, journals and financial data), a working contact route, and withdrawal
      terms that match what you actually do.

### Tier 1 — without these, the paywall is fiction

- [x] **Retention (chokepoint 4) is enforced** — the first gate with anything standing on it. Price
      history is clipped to the plan's window, which is what makes the portfolio planner a paid
      feature, and the planner now refuses to draw a frontier from a truncated range. See 3.2.
- [x] **Tracked tickers (chokepoint 3) is enforced**, on both creation paths, with its meter on the
      tickers tab and a 402 that names the limit rather than reading as a save failure. See 3.3.
- [ ] **Wire storage (1)** — biggest number, but needs `sizeBytes` in the upload schema and the
      delete-side decrement to land with it.

- [ ] **Render the pricing table from the API, not `shell-front/src/config/pricing.ts`.** The landing
      page and its pricing table exist, but `LIMIT_ROWS` is a hardcoded list of seven limits,
      self-described as an interim source. Shipping that at the moment money changes hands recreates
      the exact Phase 0 defect, only now with a payment attached. `GET /api/plans` already returns
      `effectiveLimits`. `PRICING_STATUS` stays `'preview'` until this and the chokepoints land.

- [ ] **Let people stop paying without emailing you** (5.2). There is no billing portal, and
      `past_due` appears in the UI only as a chip colour on the admin list. A customer who can pay but
      cannot cancel, update a card, or find an invoice is a chargeback and a complaint, and both cost
      more than the subscription.

### Tier 2 — real value, but they can follow the first customer

- [ ] Annual billing (5.3). `priceYearlyCents` is set on both paid plans and cannot be bought.
- [ ] Trial (Phase 6). Worth far more now that meters are visible.
- [ ] The AI dispatch path (3.1). Until it exists, keep `aiJobs` off the pricing page — it is
      currently *on* it, in `pricing.ts`, badged "coming soon".
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
`consumeQuota`, `releaseQuota`, `setUsage`). `consumeQuota` increments then checks the
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

**Plan codes** are settled as `free` / `personal` / `family` (+ hidden `staff`). Old codes were
dropped rather than mapped forward; anything unknown resolves to free.

---

## Phase 3 — Wire the chokepoints

- [ ] **Wire the six chokepoints:**

      | # | Chokepoint | Service | File | Check |
      |---|---|---|---|---|
      | 1 | Signed upload URL | album | `controllers/photoController.ts` → `getUploadSignedUrlRequest` | `requireQuota('storageBytes', size)` |
      | 2 | AI analysis dispatch | album | **does not exist yet — see 3.1** | `consumeQuota('aiJobs', 1)` |
      | 3 | ✅ Add tracked ticker | finance | `services/trackedTickerUsage.ts` | reserve/release — **shipped, see 3.3** |
      | 4 | ✅ Ticker price history range | finance | `controllers/tickerPriceHistory.controller.ts` | `retentionFloor()` — **shipped, see 3.2** |
      | 5 | Add group member | group | `controllers/groupController.ts` | `requireQuota('seats', 1)` vs owner's plan |
      | 6 | Statistics + journal reads | relationship | `services/statistics.service.ts` | `retentionFloor()` as `$match` |
      | 7 | Clean export | album | **does not exist yet — see 3.0** | `requireEntitlement('cleanExport')` |

      **Recorded is not enforced.** `storageBytes` and `seats` still carry accurate live numbers —
      the nightly reconciliation keeps them true and the album dashboard renders one — while nothing
      reads them at a write. Until those gates land, the free plan and Family differ in two respects:
      how far back price history reaches, and how many symbols may be tracked.

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
      paywall. `Plan.limits` is editable at runtime, so this is a `PUT` and not a release — update
      Appendix A to match when you do it.

### 3.0 `cleanExport` has no chokepoint at all

Not one of the six, and that is an omission rather than a decision. `cleanExport` is a defined
`FeatureKey`, it is set on all four plans in `DEFAULT_PLAN_LIMITS`, and `pricing.ts` already
advertises *"Collage export, watermarked"* on the free tier — while **no watermarking code exists
anywhere and nothing calls `requireEntitlement('cleanExport')`.** That is the Phase 0 defect
returning: a limit advertised and unenforced.

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

- [ ] **Until one of them lands, take the watermark line off the pricing page**, exactly as `aiJobs`
      is being held back. Advertising it is the part with legal exposure, not the missing feature.

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

Until one lands, treat `aiJobs` as advertised-but-unenforced and **leave it off the pricing page**.

### 3.2 The planner gate is the price-history range ✅ SHIPPED

`PortfolioPlanner.tsx` computes everything client-side and `finance-service` has **no** planner route,
so a `<PaywallGate>` on that page would be cosmetic — anyone can bypass it from devtools. The real
server-side handle is the data the simulation needs: `HISTORY_YEARS = 2`, and the frontier's
covariance estimate is meaningless without roughly that much daily history.

- [x] **`retentionFloor()` applied to `getTickerPriceHistory`.** The floor sits *underneath* the
      caller's `from`, so a client can narrow its window but never widen it past the plan. Free
      resolves to 90 days and the rows are simply not returned — there is nothing here to bypass.

- [x] **Retention resolves across several subjects, taking the most generous.** This is new and it
      matters: retention is not a counter, so unlike a quota it has no single payer. Resolving it
      from the caller alone would show a free member of a paid Family group ninety days of a
      household's history the household paid to keep — the opposite of what "shared across a
      household" sells. `retentionFloor` now accepts `string | string[]`, and the controller passes
      the caller plus the owners of the groups in scope. An empty list resolves to the *free* floor,
      never to unlimited.

      A group whose owner cannot be resolved is skipped rather than failing the read: history is a
      read, and reads are never gated to the point of denial — the floor degrades to the caller's own
      plan.

- [x] **The planner refuses to draw a frontier from a truncated range.** Deliberately a
      *data-sufficiency* check rather than a "was I truncated?" check: it is robust without a server
      signal, and it also covers the honest case of an instrument nobody has tracked for long. A
      confidently wrong efficient frontier is worse than a locked feature.

      **Corrected the same day it shipped, after it blocked a `staff` account.** Three things were
      wrong with the first version, and the third is the one worth remembering.

      - **365 days was unreachable.** Alpha Vantage's free tier serves only the *compact* series
        (~100 trading days; `outputsize=full` is premium), so a freshly tracked instrument cannot
        reach a year of history until a year of daily updates has accrued. The gate therefore
        blocked every account, paying or not — the flagship paywall was refusing the people who had
        paid. The threshold is now 120 days plus a `10 × assets` observation rule, the latter being
        the part that actually protects the estimate.
      - **It measured the wrong series.** It took the span of the *longest* holding, while the
        covariance is only as good as the days all holdings share. `covariance` pairs its inputs by
        position, so a ten-year series and a six-month one were being scored index-against-index —
        2015 returns against 2026 returns. `alignSeries` now intersects on dates, `returnIndices`
        drops any "return" taken across a gap longer than a long weekend, and the gate measures that
        overlap. A single recently-added holding legitimately caps the whole estimate.
      - **The notice blamed the plan unconditionally.** "Plans with full history keep every close
        ever fetched", shown with a *See plans* button, to an account whose retention is already
        unlimited and whose real problem was that its instruments had been re-keyed in June. It now
        reads the caller's own `retentionDays` and only frames it as an upgrade when retention is
        what clipped the range; otherwise it says so plainly. **A paywall shown to someone who
        cannot buy their way out of it is worse than no paywall** — it is a bug report at best and a
        false claim at worst.

- [x] `retentionDays` therefore gates the planner *and* the relationship history — one meter, two
      products. Simplifies the pricing story; note it in the landing copy.

**Correction:** this section used to claim the endpoint did an unbounded `find().sort()`. That was
fixed independently — the service already filters, projects the tracked-ticker scope, sorts on the
`{ ticker, date }` index and caps rows at `DEFAULT_PRICE_HISTORY_LIMIT`.

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

### 3.3 Tracked tickers ✅ SHIPPED

The limit with the most defensible story on the pricing page: Alpha Vantage's free tier is 25 calls
per day *for the whole deployment*, and the daily job spends one per distinct active symbol, so this
is the meter where subscription revenue buys the thing that makes the feature work.

- [x] **It is not `requireQuota` on the route, and that is the interesting part.** The meter counts
      *distinct active symbols*, not rows — one call per symbol per day however many rows hold it — so
      whether a write costs a slot is a question about what the subject already tracks, which a
      generic middleware cannot ask. `services/trackedTickerUsage.ts` owns it instead: resolve the
      billing subject, ask the collection whether the symbol is already covered, and only then
      `consumeQuota`. Two things fall out of that. Adding a symbol a group already follows is *free*
      rather than refused at the ceiling, which is what the reconciliation would have said anyway. And
      because the logic is a service call rather than route middleware, it also guards the **other**
      creation path: `createHolding` tracks its ticker automatically, so a gate on
      `POST /tracked-tickers` alone would have been bypassable by adding a holding instead.

- [x] **Reserve before the write, release after it.** `consumeQuota` runs first — atomic, so the loser
      of two concurrent adds at the ceiling is the one rejected — and its increment is rolled back if
      the write then fails (a duplicate key, a `ForbiddenError`). Deletes, pauses, renames and moves
      between groups all resync: each asks, *after* the write, whether anything still covers the old
      symbol, so a second row in the same scope keeps the slot held and the last one hands it back.

- [x] **Cross-scope dedupe, as far as the caller can see.** A symbol held both personally and in a
      group the caller owns bills once, matching how the nightly reconciliation counts it: the scope
      resolver walks the caller's own groups through the cached `getGroupOwner`. What it cannot see is
      the *other* scopes of a group owner who is not the caller — a member adding a symbol the owner
      already tracks personally spends a slot the reconciliation later gives back. That is a bounded
      one-slot over-count on a derived meter, absorbed by the job that exists for exactly this;
      closing it would need a "groups owned by X" internal endpoint plus an email→userId lookup.

- [x] **Shipped with its meter, per 4.4.** `<UsageMeter>` sits directly above the *Track ticker*
      button, fed by the same `GET /api/subscriptions/me/entitlements` the album dashboard uses, and
      every ticker mutation invalidates it so the bar moves with the write. It meters `usage
      .trackedTickers` — the account's pooled symbol count — not the rows in the visible table, which
      show one group context.

- [x] **A 402 must not read as "Failed to save ticker".** `utils/paywall.ts` renders the 402 body into
      the snackbar both investment tabs already have ("You have reached the tracked tickers limit (3)
      on your free plan. Upgrade to personal for more."). It is deliberately small and local: the
      shared `<UpgradeDialog>` of 4.2 replaces it, and until that exists the alternative is a paywall
      indistinguishable from a bug. Both tabs use it, because adding a *holding* can now 402 too.

---

## Phase 4 — Make the meters visible

Gating without surfacing is indistinguishable from breakage — and since enforcement is unconditional,
Phase 3 lands *already blocking*. This phase is concurrent with Phase 3, not after it: a chokepoint
wired without the meter beside it is a feature that silently stops working.

### 4.1 Shared components

`<UsageMeter>` and `useEntitlements` are done (see What's built). Remaining:

- [ ] **`<PaywallGate>`** — wraps a locked feature, rendering it blurred-but-visible behind an inline
      unlock card. Show the planner's real chart under the gate. Nobody pays for a feature they've
      never seen.
- [ ] **`<UpgradeDialog>`** — driven entirely by a 402 body, so it names the exact meter that blocked
      and the exact plan that lifts it.
- [ ] **`<PlanBadge>`** — into `shell-front/src/components/AccountMenu.tsx`.

### 4.2 402 handling in the API client

- [ ] **`libs/frontend-core/src/apiClient.ts`** — add an `onPaymentRequired?: (body) => void` option
      alongside the existing `onUnauthorized`, fired on `response.status === 402`. Wire it once per
      app's `ConfigProvider` to open `<UpgradeDialog>` and every frontend inherits upgrade prompts for
      free. `ApiError` already carries `status` and `body`, so callers that want to handle it locally
      still can.

### 4.3 Placements

album-front's storage meter is done. Remaining:

- [x] **finance-front** — meter on `components/investments/TickersTab.tsx` (see 3.3), and
      `pages/PortfolioPlanner.tsx` renders the upgrade state when the returned price history is
      shorter than `HISTORY_YEARS` demands (per 3.2) — not a wrapper gate, since the real enforcement
      is server-side on the data.
- [ ] **relationship-front** — when retention clips a chart, label it ("showing 90 of 540 days"). A
      silently short chart reads as a bug; a labelled one reads as an upgrade.
- [ ] **group-front** — seat counter on the members list, gate the invite button at the cap.
- [ ] **payment-front `PlansPage`** — render limits from the API, monthly/annual toggle with the
      saving as a real number, mark the current plan, buttons that say what will happen ("Switch to
      Family", not "Subscribe").

Each front needs `PAYMENT_API_URL` threaded through its four config surfaces (ConfigProvider,
`vite-env.d.ts`, `docker-entrypoint.sh`, `compose.yml`) plus its `.env.example` for local dev — album
and finance fronts now have all five. The deploy workflows already write `PAYMENT_API_URL` into
`.env.app`, so a front that declares it in `compose.yml` picks it up with no pipeline change.

### 4.4 Rollout

- [ ] There is no switch to flip. The rollout unit is the **chokepoint**: wiring one gate turns that
      limit on, everywhere, immediately. Order them as Tier 1 above, and ship each gate together with
      its meter — a user who cannot see the ceiling experiences the 402 as a bug.
- [ ] ~~Grandfather existing users onto Personal for 90 days.~~ Moot — no existing paying users.
      Existing *free* users still get metered for the first time, so the "what happens when you hit a
      limit" copy in 5.1 is doing this job instead.

---

## Phase 5 — Commercial surface

### 5.1 The front page

**Largely built.** `shell-front` has `LandingPage`, `HeroSection`, `PricingTable` and `LandingFooter`,
and `/` branches on auth — signed-out visitors get the landing page, signed-in users the dashboard.
Remaining:

- [ ] **Render the pricing table from the API** rather than `config/pricing.ts` (see Tier 1).
- [ ] **Write the paywall explanation honestly, above the price table.** The highest-trust thing a
      small paid product can do is explain its limits before charging. Three short paragraphs:

      - **What's free forever.** Concretely — 1 GB, 3 tickers, 90 days of history, full album and
        journal features. Not "generous free tier."
      - **What costs money and why.** Storage and AI analysis cost real money per photo. Market data
        has a hard external ceiling — Alpha Vantage's free tier is 25 calls/day *across the whole
        deployment* — so tracked tickers convert subscription revenue directly into the thing that
        makes the feature work. Saying that reframes the limit as honest cost recovery, and it is true.
      - **What happens when you hit a limit or stop paying.** Nothing is deleted. Reads stay open;
        only new writes are capped. Downgrading hides data, never destroys it. Cancelling keeps access
        to the end of the period paid for. Each is a specific fear that stops people subscribing to a
        small indie product, and `canceling` plus "reads are never gated" makes all three true.

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
- [ ] **Surface `past_due`.** The webhook sets it and no user-facing UI mentions it. Persistent banner
      with a fix-payment link, a defined grace period (recommend 7 days, entitled throughout), then
      downgrade to free. Involuntary churn is roughly a third of all churn for small subscription
      products, and by far the cheapest to win back.

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
- [ ] **Trial-ending email at day 11** with actual usage numbers in it.

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
      data key must be upgraded *before* the next signup.

---

## Appendix A — Limits

These are the **code defaults** in `DEFAULT_PLAN_LIMITS` — what a Plan resolves to before an admin
edits it, and the outage fallback. The authority is `Plan.limits` in Mongo; change numbers there
without a deploy, and update this table when you do.

| Meter | `free` | `personal` €6/mo · €60/yr | `family` €12/mo · €120/yr |
|---|---|---|---|
| `storageBytes` | 1 GB | 50 GB | 250 GB pooled |
| `aiJobs` (per month) | 25 | 200 | 600 |
| `trackedTickers` | 3 | 25 | 100 |
| `seats` | 1 | 1 | 5 |
| `retentionDays` | 90 | unlimited | unlimited |
| `cleanExport` | ✗ (watermarked) | ✓ | ✓ |

`retentionDays` does the most work: it gates the relationship history *and*, via the price-history
range, the portfolio planner. **The planner is the best paywall in the codebase** — the most
sophisticated thing built, an obvious commercial analogue, and locking it costs nothing in goodwill
because casual users never open it. Retention is also self-strengthening: someone with eighteen months
logged who can see ninety days has a reason to pay that grows every month they stay.

`aiJobs` is listed but **not sellable until 3.1 lands**, and `cleanExport` is **not enforceable at all
today** — see 3.0. Both should stay off the pricing page until they are real.

Album storage is deliberately *not* the primary paywall. People expect photo storage free from Google;
finance is where willingness to pay lives, and groups is where expansion revenue lives.
