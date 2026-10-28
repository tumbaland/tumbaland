import { FALLBACK_PLAN, PlanLimits, applyLimits, normalizeLimits } from '@tumbaland/backend-core';
import { Subscription, ISubscription } from '../models/Subscription';
import { Plan, IPlan } from '../models/Plan';
import { EntitlementOverride } from '../models/EntitlementOverride';

/**
 * Statuses that still grant access.
 *
 * `canceling` is entitled because the user paid for the period that is still
 * running. `past_due` is entitled because cutting access the instant a card
 * fails converts recoverable involuntary churn into real churn — the dunning
 * grace period is where that gets decided, not here.
 */
export const ENTITLED_STATUSES = ['active', 'past_due', 'canceling'] as const;

const STATUS_RANK: Record<string, number> = { active: 3, canceling: 2, past_due: 1 };

/** Matches documents with no expiry, or one still in the future. */
export function notExpired(now: Date = new Date()) {
  return { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] };
}

export interface ResolvedEntitlements {
  email: string;
  planCode: string;
  status: string | null;
  limits: PlanLimits;
  upgradeTo?: string;
  /** True when the plan was granted by an admin rather than bought. */
  isComp?: boolean;
  /** True when a per-user override adjusted the plan's limits. */
  hasOverride?: boolean;
}

/** Structural, so the populated Mongoose result type passes without a cast. */
type RankableSubscription = Pick<ISubscription, 'status' | 'planCode' | 'createdAt'> & {
  plan?: IPlan | null;
  isComp?: boolean;
};

/**
 * Highest-priced entitled subscription wins, then better status, then newer —
 * except that a comp grant outranks everything.
 *
 * Price is only a proxy for "which of these grants more". An admin handing
 * someone the staff plan is stating the answer outright, and the staff plan is
 * priced at zero, so ranking it by price would let any paid subscription the
 * same account happens to hold quietly beat it.
 */
function pickBest<T extends RankableSubscription>(subs: T[]): T | undefined {
  return [...subs].sort((a, b) => {
    const compDelta = Number(b.isComp ?? false) - Number(a.isComp ?? false);
    if (compDelta !== 0) return compDelta;
    const priceDelta = (b.plan?.priceMonthlyCents || 0) - (a.plan?.priceMonthlyCents || 0);
    if (priceDelta !== 0) return priceDelta;
    const rankDelta = (STATUS_RANK[b.status] || 0) - (STATUS_RANK[a.status] || 0);
    if (rankDelta !== 0) return rankDelta;
    return b.createdAt.getTime() - a.createdAt.getTime();
  })[0];
}

/**
 * Cheapest public plan priced above the current one — the CTA on a 402.
 *
 * `isPublic` is filtered here as well as in the catalog: the staff plan lifts
 * every limit, and offering it as the upgrade target would point a paying
 * customer at something they cannot buy.
 */
async function findUpgradeTarget(currentPriceCents: number): Promise<string | undefined> {
  const next = await Plan.findOne({
    isActive: true,
    isPublic: { $ne: false },
    priceMonthlyCents: { $gt: currentPriceCents }
  })
    .sort({ priceMonthlyCents: 1 })
    .lean();
  return next?.code;
}

/**
 * The authoritative answer to "what does this user get".
 *
 * Three layers, each stored, each partial, each overriding the last:
 *
 *   1. code defaults for the plan code (`DEFAULT_PLAN_LIMITS`)
 *   2. the Plan document's `limits` — what an admin sets for everyone on the plan
 *   3. the user's `EntitlementOverride` — what an admin sets for one person
 *
 * Nothing is hardcoded per user anywhere, and no environment variable decides
 * who gets what: an override is a document with a reason, an author and an
 * optional expiry, which is what makes it reviewable a year from now.
 */
export async function resolveEntitlements(rawEmail: string): Promise<ResolvedEntitlements> {
  const email = rawEmail.trim().toLowerCase();
  const now = new Date();

  const subs = await Subscription.find({
    userEmail: email,
    status: { $in: ENTITLED_STATUSES },
    ...notExpired(now)
  }).populate<{ plan: IPlan }>('plan');

  const best = pickBest(subs);
  const planCode = best?.plan?.code ?? best?.planCode ?? FALLBACK_PLAN;

  // A user with no subscription is on the free plan, and the free plan's
  // limits are admin-configurable like any other — so read its document too.
  let planDoc: IPlan | null | undefined = best?.plan;
  if (!planDoc || planDoc.code !== planCode) {
    planDoc = await Plan.findOne({ code: planCode });
  }

  const override = await EntitlementOverride.findOne({ userEmail: email, ...notExpired(now) });
  const planLimits = normalizeLimits(planDoc?.limits, planCode);
  const limits = override
    ? applyLimits(planLimits, {
        meters: override.meters,
        features: override.features,
        retentionDays: override.retentionDays
      })
    : planLimits;

  const isComp = best?.isComp === true;

  return {
    email,
    planCode,
    status: best?.status ?? null,
    limits,
    // Nothing to upsell someone an admin handed a plan to — and since a comp
    // plan is priced at zero, the price-based lookup would otherwise point a
    // staff account at the cheapest paid plan as an "upgrade".
    upgradeTo: isComp ? undefined : await findUpgradeTarget(planDoc?.priceMonthlyCents ?? 0),
    isComp,
    hasOverride: Boolean(override)
  };
}
