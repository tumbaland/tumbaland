# Monetization — parked

**Status: parked, 2026-08-24.** Nobody is charged, paid checkout is closed, and the front page asks
for support rather than selling tiers. The entitlement backbone stays live because it is what keeps
the free tier bounded — limits are enforced, meters are recorded, reconciliation runs nightly.

**Why.** What stands between here and a first customer is mostly not code: a legal entity, a privacy
policy with erasure and export actually implemented behind it, Stripe Tax registration, and a
market-data key that can deliver the ticker counts the plans advertise. That is weeks of non-product
work bet on demand nothing has evidenced — no customers, no waiting list, one live charge ever (the
maintainer's, already dead at Stripe).

This file was a 777-line implementation plan across six phases. What survives is: what must be done
anyway, what is live and how it works, and the conditions for unparking. The phase plans are in git
if they are ever wanted.

---

## Critical — do these regardless of monetization

Four of the five are only *filed* under monetization; they are owed whether or not anyone ever pays.
Ordered by what hurts most if left.

- [ ] **The AI services take no authentication at all.** `album-front`'s `segmentationService.ts`
      POSTs straight to `SEGMENTATION_API_URL/api/v1/segmentation/segment` with no `Authorization`
      header and no credentials, and the object-detection path is the same shape. Those services are
      not even in this repo. Anyone who can reach the port dispatches GPU work on our bill, with no
      account and no rate limit.

      Fix: a dispatch endpoint on `album-service` that authenticates, then forwards. The frontend
      calls that instead of the ports directly. Metering at result submission
      (`PUT /photos/:id/ai-analysis`) is **not** a substitute — the GPU cost is already spent, and a
      client that never submits results consumes unlimited compute for free.

      *This is also the only reason `aiJobs` cannot be metered, but do it for the abuse risk.*

- [ ] **Alpha Vantage allows 25 calls/day for the whole deployment, and the free tier sells 3 tracked
      tickers per user.** The daily job spends one call per distinct active symbol. Roughly eight
      free users on distinct symbols exhaust the entire deployment's quota and the daily job starts
      failing *for everyone*. The live account tracks six symbols, which is the only reason nothing
      has broken.

      This used to be a pricing problem (`support` sells 100 symbols — four times the whole
      deployment's daily quota, for one supporter). Parking the paywall did not remove it; it
      removed the revenue that would have paid for a bigger key. Decide now: cut the free tier's
      ticker count to what 25 calls/day supports, or upgrade the key and absorb the cost.
      `DAILY_LIMIT = 25` in `finance-service/src/services/apiQuota.service.ts`.

- [ ] **No account deletion, and nothing exports a user's data.** auth-service has neither. We hold
      photos, journals and financial data for real people right now, free of charge — GDPR erasure
      (Art. 17) and portability (Art. 20) do not wait for a payment, and this is the one item on the
      list that is live legal exposure today rather than a risk of one.

      Ship delete-my-account and an export **before** publishing a privacy policy, not after:
      publishing the policy first converts a gap into a written commitment.

- [ ] **`TermsPage.tsx` makes claims that are false and were always false.** 63 lines of boilerplate
      saying subscriptions are "non-refundable" — which conflicts with the EU right of withdrawal
      anyway — and referencing a Privacy Policy that does not exist as a page, all while nothing is
      for sale. Smallest item here: strip it to what is actually true today, or replace it with a
      real one alongside the privacy policy above.

- [ ] **Nobody has ever hit a paywall.** Both maintainers hold `staff` — every meter unlimited — so
      no one has watched a meter fill, a bar turn amber, or a 402 land in the wild. Enforcement is
      live and unconditional; a free user is meeting these gates untested. One free-plan test account
      is the cheapest possible check that the three live chokepoints read as *prices* rather than as
      bugs, and it validates work that is already shipped.

### Also parked here, and not about money

- [ ] **A symbol is a foreign key, and the product has no rename path.** Price rows are keyed by
      ticker string and reads are scoped to currently-tracked symbols, so re-adding a ticker under a
      new symbol silently orphans its history. When the tracked tickers were re-added under Alpha
      Vantage's exchange suffix in June 2026 (`VUSA.DE` → `VUSA.DEX`), 5,612 rows going back to 2015
      became unreachable. `scripts/migration/merge-renamed-ticker-history.js` repaired that instance
      (run 2026-08-09: 5,339 rows moved); nothing prevents the next one. With `retentionDays` gating
      the planner, the failure reads to a user as a paywall.

- [ ] **The planner still reads the daily price series.** The weekly series exists (2,632 closes
      across six symbols, a 2.4-year shared window against 150 days on the daily basis). Choosing the
      basis with more observations, and annualizing weekly returns by 52 rather than 252, is the
      remaining step — the data is there, the estimate does not use it.

---

## What is live

**Three chokepoints enforce.** Storage refuses an upload that would not fit, at the signed-URL
request, with the bytes handed back on delete. `trackedTickers` refuses a symbol past the plan's
ceiling on both paths that track one. `retentionFloor` clips price history, which is what makes the
portfolio planner a paid feature.

**Recorded but not enforced:** `seats` carries an accurate live number that nothing reads at a write.
`aiJobs` cannot be metered until the dispatch endpoint above exists, and `cleanExport` has no
enforcement anywhere — collage export is entirely client-side, so a `requireEntitlement` gate has
nothing to sit on. **Neither is advertised**, on any card, meter or FAQ line: a number shown to a user
is a claim the product is held to, and that rule is what the pricing table was rebuilt to obey.

**Limits are visible.** `<UsageMeter>` on album-front (dashboard, upload dialog) and finance-front
(tickers tab, planner), and `<PlanUsageCard>` on shell-front's home page — the one surface that shows
every *enforced* ceiling with live usage to every signed-in account, free ones included, without them
having to be inside the module that would refuse them.

**The front page asks for support, not subscriptions.** `SupportSection` (was `PricingTable`): free
is the highlighted card badged "Where everyone starts", the paid card's button reads "Become a
supporter" rather than naming an edition to buy, and the section sits below the FAQ that explains
why limits exist. Its numbers come from `GET /api/plans`, resolved by the same `normalizeLimits` the
middleware enforces from, so a card's ceiling and the ceiling that produces a 402 are one value. A
failed catalog says so rather than rendering numbers of its own.

| Route | Who | What |
|---|---|---|
| `GET /api/plans` | any user (optional auth) | public plans + `effectiveLimits`, plus the caller's own hidden plan |
| `GET /api/plans/all` · `/catalog` | admin | every plan; meter vocabulary for an admin form |
| `PATCH /api/plans/:code` · `PUT /api/plans/:code/limits` | admin | plan fields; limits (merge, or `?replace=true`) |
| `GET /api/subscriptions/me/entitlements` | any user | own plan, limits **and live usage** |
| `GET/POST /api/subscriptions/grants` · `DELETE .../:email` | admin | comp grants |
| `GET/PUT/DELETE /api/entitlement-overrides/:email` | admin | per-user adjustments |
| `GET /internal/entitlements?email=` | services | entitlement truth |
| `GET /internal/groups/:id/owner` | services | the quota subject for anything pooled |

Reconciliation runs nightly at **03:30** from payment-service and is also a CLI (`npm run
reconcile:usage --workspace=payment-service`, dry-run by default, `--apply`, `--user=`). It reads
`photos.size` rather than the denormalized `Album.totalSize`, and *reports* disagreement instead of
rewriting another service's field. A run that corrects anything logs `entitlement.reconciled` at
`warn` — a recurring correction is a leak in `consumeQuota`/`releaseQuota` worth chasing.

**Plan codes are `free` / `support`, plus hidden `staff`.** Anything unknown resolves to **free**,
never unlimited.

`personal` (€6) and `family` (€12) were consolidated into a single `support` tier at **€5/month ·
€50/year**, carrying the old `family` limits except storage, which drops from 250 GB to 50 GB — 250
was priced for a household paying €12. Two paid columns ask a visitor to work out which edition of
the product they are entitled to, which is a question a business asks; one tier that grants
everything leaves only the question actually being asked. The old plans are **retired, not deleted**
(`isActive: false, isPublic: false`), which keeps them out of the catalog and out of `upgradeTo`
while leaving the documents that historical rows point at.
`payment-service/scripts/migration/consolidate-support-plan.js` does the database half (dry-run by
default, `--apply`), and is idempotent.

---

## How it works, and why

The decisions below govern code that is running. They are not part of the park.

**Entitlements are not a JWT claim.** `JWT_EXPIRES_IN = '24h'` and no service outside auth-service
checks `tokenVersion`, so a plan in the token would be stale in both directions. payment-service owns
entitlement truth and serves it over the internal-token channel; services read it through a
`backend-core` client with a 60-second cache. The client **fails closed** — an unreachable
payment-service degrades everyone to free limits rather than giving the product away for the length of
an outage — and fallbacks are never cached, so recovery is immediate. Only writes and dispatches are
gated, never reads, so the worst case is "cannot upload for a minute", not "cannot use the app". Both
internal routes are mounted **ahead of the rate limiter**: every service asks from one container IP,
and since the clients fail closed a 429 would read as "everyone is free".

**Limits live in the database, not in a code table.** A limit is a commercial dial, and pinning it to a
deploy guarantees it drifts from what is advertised. `Plan.limits` in Mongo is the authority, editable
at runtime; `backend-core/src/entitlements/definitions.ts` owns the *vocabulary* (meter keys, units,
periods, `DEFAULT_PLAN_LIMITS`) but not the values. `normalizeLimits(stored, planCode)` merges them —
stored wins, missing keys fall back to defaults, unknown keys are dropped — so a meter added in code
works everywhere immediately and a typo in an admin form cannot invent one. Defaults are the floor and
the outage fallback, which is why `free`'s must stay conservative.

**Three layers, no exemption branch.** Code defaults → `Plan.limits` → `EntitlementOverride`, all
merged by the one `applyLimits` step so the rules cannot diverge. A **comp grant** is an ordinary
Subscription with `isComp: true` and no Stripe ids ("this person is on this plan and pays nothing") and
shows as their plan; an **override** adjusts limits for one person on top of whatever plan they hold
and is invisible. Both are documents, not environment variables: an `ENTITLEMENTS_EXEMPT_EMAILS`
allowlist was rejected because it needs a redeploy, is invisible to the admin UI, and creates a path
where enforcement is skipped entirely. Every grant carries `grantedBy`, a `reason` and an optional
`expiresAt`. `staff` is a real plan with `isPublic: false`, excluded from the catalog but added back
by `GET /api/plans` for the people on it, and it outranks a paid subscription in `pickBest` — ranking
purely by price would let any paid plan quietly beat an explicit admin grant.

**`subjectId` is an email, and pooled resources bill to the group owner.** `UsageMeter.subjectId` is
an email, but `Album.userId` and `TrackedTicker.userId` are the auth-service `User._id` — anything
attributing those to a meter must join through the `users` collection first. `support` sells *"50 GB
pooled"* across up to five seats, and pooled means one meter: if storage charged the uploader, every
shared upload would come out of the uploader's own free 1 GB. This is not an edge case — every album
and every tracked ticker in the live database belongs to a group. The owner is `members[].role ===
'owner'` (what every authorization check tests; `createdBy` goes stale and is only the fallback).
Soft-deleted groups still bill storage and tickers, but not seats. **A subject that was inferred
rather than resolved is checked against but never written to**: an unreachable group-service bills
the caller for the check but touches no meter, because charging the wrong account is worse than a
counter that lags.

**Enforcement is unconditional — there is no mode switch.** `ENTITLEMENTS_MODE`
(`off`/`observe`/`enforce`) shipped with the backbone and was deleted before any chokepoint used it:
two weeks of observation across three accounts, two of them unlimited `staff`, would have produced an
empty log at the cost of a three-valued branch on every gate and a path where enforcement is skipped
entirely. What decides whether a limit bites is structural — whether a chokepoint calls it — and the
numbers move at runtime through `PUT /api/plans/:code/limits`. Every rejection logs a structured
**`entitlement.blocked`** beside the 402: meter, subject, used, limit, plan, route, and whether the
entitlement was a stale fallback. **The `stale` flag is the one to alert on** — a run of blocks against
fallback limits means payment-service is down and people are being held to free limits, a different
incident from a limit set too tight.

**Reserve before the write, settle after it.** Tickers use `consumeQuota` (which increments then checks
the *post*-increment value, so the loser of a race is the one rejected) with rollback on a failed write,
and release on delete/pause/rename/move. Storage cannot: the gate runs at the signed-URL request, the
only point where a file's size is known before its bytes exist, so the increment happens later at
`createPhoto` via `recordUsage`, which never rejects — refusing there would decline a record for bytes
already in MinIO. The overrun that buys is bounded and self-correcting: the *next* upload is refused.

**A quota that counts something other than rows belongs in a service, not in `requireQuota`.**
`trackedTickers` counts distinct active symbols — a database question generic middleware cannot ask —
and putting it in a service also covered the second creation path (`createHolding` tracks its ticker
automatically). Storage is a service for the same shape of reason: the billing subject depends on the
album's group, which the route has not loaded.

**Derived meters can be reconciled; `aiJobs` cannot.** `storageBytes`, `trackedTickers` and `seats` are
derived — the collection is the record and the counter is a hot cache of it — so drift is always
repairable, which is what makes a nightly job the right shape. Nothing but the counter records that a
GPU job happened, so there is no truth to recompute from. That is why `consumeQuota` rolls its
increment back on rejection: a leaked increment on `aiJobs` is permanent.

**Shared libs ship from npm.** Services install `@tumbaland/backend-core` inside their Dockerfile and
the fronts install `@tumbaland/frontend-core` and `@tumbaland/components` the same way (see
`scripts/sync-lib-versions.mjs`), so any shared-lib change must be released before the consuming
service or front is rebuilt. Local dev resolves through the workspace symlink. Currently published and
pinned: backend-core `1.28.0`, frontend-core `1.10.0`, components `1.21.0`.

---

## If this is ever unparked

None of it got cheaper by being deferred. In order:

1. **Everything in Critical above**, particularly the GDPR mechanisms and the ticker quota — the
   plans cannot be sold on the current data key at any price.
2. **Set `stripePriceId` on `support`** via `PATCH /api/plans/:code/stripe-prices`. Until then the
   paid plan returns **503** — the intended state, but it means checkout is closed
   rather than merely unfinished.
3. **Enable Stripe Tax and register an origin address.** Checkout passes `automatic_tax`, so until
   that is done Stripe rejects the session outright. Register for **OSS** before the first
   non-domestic EU sale.
4. **Real Terms naming a legal seller, a privacy policy, and a working contact route**, with
   withdrawal terms that match what we actually do.
5. **Billing self-service.** Cancelling is built. A customer still cannot update a card, find an
   invoice, or understand `past_due` — it renders as a bare chip with nothing to click. Stripe's
   billing portal buys all three plus dunning emails, which matters because there is **no
   transactional email anywhere in the backend**: no provider, no templates, no send path. Anything
   this product wants to say on its own needs that built first.
6. **Persist the webhook idempotency guard, or delete it.** `webhookEventStore` is an in-memory `Set`:
   it does not survive a restart and is not shared between replicas. The real defence today is that
   the handlers are mostly idempotent. What it must not stay is a guard that reads as stronger than it
   is.
7. **The seats over-cap policy, decided before the gate is wired.** A five-member Family group
   downgrading to Personal is over its cap the moment the plan changes, and the members are still
   there every day. The only answer consistent with *"downgrading hides data, never destroys it"* is
   **enforce on add, never evict** — the group keeps its members and the next invite is refused.
   Write it down rather than letting the middleware decide it by omission.
8. Annual billing (`priceYearlyCents` is set and cannot be bought), then a trial, then instrumentation
   — in that order, and only once something converts.

**Read the billing half more suspiciously than the entitlement half.** Everything about entitlements
was written while building it. The Stripe half predates the code, and the last defects found there
were found by reading `stripeController.ts`, not by reading this file — which described those paths as
settled.

---

## Appendix — limits

The **code defaults** in `DEFAULT_PLAN_LIMITS`: what a Plan resolves to before an admin edits it, and
the outage fallback. The authority is `Plan.limits` in Mongo — change numbers there without a deploy,
and update this table when you do.

| Meter | `free` | `support` €5/mo · €50/yr |
|---|---|---|
| `storageBytes` | 1 GB | 50 GB pooled |
| `aiJobs` (per month) | 25 | 600 |
| `trackedTickers` | 3 ⚠ | 100 ⚠ |
| `seats` | 1 | 5 |
| `retentionDays` | 90 | unlimited |
| `cleanExport` | ✗ (nothing watermarks) | ✓ |

⚠ **Both `trackedTickers` numbers are above what the deployment can serve** — 25 Alpha Vantage calls
per day for the *whole deployment*, one per distinct active symbol. Nine free users exhaust it; one
supporter at the ceiling needs four times it. See Critical.

`aiJobs` and `cleanExport` are listed because they are defined, **not because they are enforceable**;
neither is advertised anywhere.

`retentionDays` does the most work: it gates the relationship history *and*, via the price-history
range, the portfolio planner. The planner is the best paywall in the codebase — the most sophisticated
thing built, an obvious commercial analogue, and locking it costs nothing in goodwill because casual
users never open it. Retention is also self-strengthening: someone with eighteen months logged who can
see ninety days has a reason to pay that grows every month they stay.

Album storage is deliberately *not* the primary paywall. People expect photo storage free from
Google; finance is where willingness to pay lives.

**Thumbnails are unmetered.** Reconciliation counts `photos.size` only, so a second counter for them
would be corrected back every night. Real MinIO usage is understated by the thumbnail share — worth
answering as a *limit* number here rather than as another meter.
