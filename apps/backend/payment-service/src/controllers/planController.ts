import { Request, Response } from 'express';
import { z } from 'zod';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ENTITLEMENT_CATALOG,
  normalizeLimits,
  PlanLimits
} from '@tumbaland/backend-core';
import { Plan, IPlan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { ENTITLED_STATUSES, notExpired } from '../services/entitlementService';
import { planInputSchema } from '../validation/schemas';

/**
 * A plan as the API returns it: the stored document plus `effectiveLimits`,
 * the fully-resolved numbers after code defaults fill whatever the document
 * leaves unset.
 *
 * The pricing page renders `effectiveLimits`, which is what stops it
 * advertising limits nothing enforces — the number on the card and the number
 * the middleware checks are now the same value, read from the same place.
 */
function withEffectiveLimits(plan: IPlan): Record<string, unknown> & { effectiveLimits: PlanLimits } {
  const json = plan.toJSON ? plan.toJSON() : plan;
  return { ...(json as Record<string, unknown>), effectiveLimits: normalizeLimits(plan.limits, plan.code) };
}

/**
 * The public catalog — plus the caller's own plan when that plan is not public.
 *
 * Staff and comped friends are on a hidden plan, and a pricing page that shows
 * them everything *except* the plan they are actually on is worse than one that
 * shows nothing: their current plan silently reads as "free". So the hidden
 * plan is added back for the person who holds it, and for nobody else.
 */
export const listPlans = async (req: Request, res: Response): Promise<void> => {
  const plans = await Plan.find({ isActive: true, isPublic: { $ne: false } }).sort({ priceMonthlyCents: 1 });

  const email = req.user?.email;
  if (email) {
    const myCodes: string[] = await Subscription.find({
      userEmail: email.toLowerCase(),
      status: { $in: ENTITLED_STATUSES },
      ...notExpired()
    }).distinct('planCode');

    // Appended after the catalog rather than sorted in by price: a granted plan
    // costs nothing, so price order would drop it next to Free, in the middle
    // of a ladder it does not belong to. It reads as what it is — an extra —
    // at the end.
    const missing = myCodes.filter(code => !plans.some(plan => plan.code === code));
    if (missing.length) {
      plans.push(...(await Plan.find({ code: { $in: missing } }).sort({ priceMonthlyCents: 1 })));
    }
  }

  res.json({ success: true, plans: plans.map(withEffectiveLimits) });
};

/** Admin view: inactive and non-public plans included, since those are exactly the ones being edited. */
export const listAllPlans = async (_req: Request, res: Response): Promise<void> => {
  const plans = await Plan.find({}).sort({ priceMonthlyCents: 1 });
  res.json({ success: true, plans: plans.map(withEffectiveLimits) });
};

/**
 * The meter and feature vocabulary, with labels, units and periods.
 *
 * An admin UI builds its limits form from this instead of hardcoding meter
 * names, so a meter added in backend-core shows up in the form with no
 * frontend change.
 */
export const getEntitlementCatalog = (_req: Request, res: Response): void => {
  res.json({ success: true, catalog: ENTITLEMENT_CATALOG });
};

export const createPlan = async (req: Request, res: Response): Promise<void> => {
  // Support either a single object or an array for convenience
  if (Array.isArray(req.body)) {
    // Redirect to bulk handler semantics
    const created: IPlan[] = [];
    for (const raw of req.body) {
      const exists = await Plan.findOne({ code: raw.code });
      if (exists) { throw new ConflictError(`code already exists: ${raw.code}`); }
      const plan = await Plan.create(raw);
      created.push(plan);
    }
    res.status(201).json({ success: true, plans: created });
    return;
  }

  const { name, code, description, priceMonthlyCents, priceYearlyCents, features, limits } = req.body;
  const existing = await Plan.findOne({ code });
  if (existing) { throw new ConflictError('code already exists'); }
  const plan = await Plan.create({ name, code, description, priceMonthlyCents, priceYearlyCents, features, limits });
  res.status(201).json({ success: true, plan });
};

export const createPlansBulk = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as z.infer<typeof planInputSchema>[];
  // Check duplicates in request
  const codes = payload.map(p => p.code);
  const dupInRequest = codes.find((c, idx) => codes.indexOf(c) !== idx);
  if (dupInRequest) { throw new BadRequestError(`duplicate code in payload: ${dupInRequest}`); }
  // Check existing
  const existing = await Plan.find({ code: { $in: codes } }, { code: 1 }).lean();
  if (existing.length) { throw new ConflictError(`codes already exist: ${existing.map(e => e.code).join(',')}`); }
  const created = await Plan.insertMany(payload);
  res.status(201).json({ success: true, plans: created });
};

export const updatePlanStripePrices = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params as { code: string };
  const { stripePriceId } = req.body;
  const plan = await Plan.findOne({ code });
  if (!plan) { throw new NotFoundError('Plan not found'); }
  plan.stripePriceId = stripePriceId;
  await plan.save();
  res.json({ success: true, plan });
};

/** Partial edit of everything an admin owns except the code and the Stripe price ids. */
export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params as { code: string };
  const plan = await Plan.findOne({ code });
  if (!plan) { throw new NotFoundError('Plan not found'); }

  const { name, description, priceMonthlyCents, priceYearlyCents, features, limits, isActive, isPublic } = req.body;
  if (name !== undefined) plan.name = name;
  if (description !== undefined) plan.description = description;
  if (priceMonthlyCents !== undefined) plan.priceMonthlyCents = priceMonthlyCents;
  if (priceYearlyCents !== undefined) plan.priceYearlyCents = priceYearlyCents;
  if (features !== undefined) plan.features = features;
  if (isActive !== undefined) plan.isActive = isActive;
  if (isPublic !== undefined) plan.isPublic = isPublic;
  if (limits !== undefined) plan.limits = mergeLimits(plan.limits, limits);

  await plan.save();
  res.json({ success: true, plan: withEffectiveLimits(plan) });
};

/**
 * Replace-or-merge the stored limits.
 *
 * A partial body merges into what is stored, so an admin form that only knows
 * about storage cannot silently reset the other meters to their code defaults.
 * `PUT ?replace=true` drops the stored limits first, for deliberately starting
 * over from the defaults.
 */
export const updatePlanLimits = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params as { code: string };
  const plan = await Plan.findOne({ code });
  if (!plan) { throw new NotFoundError('Plan not found'); }

  const replace = req.query.replace === 'true';
  plan.limits = mergeLimits(replace ? undefined : plan.limits, req.body);
  await plan.save();

  res.json({
    success: true,
    plan: withEffectiveLimits(plan),
    // Echoed separately so an admin sees the resolved numbers — including the
    // ones the defaults filled in — without recomputing them client-side.
    effectiveLimits: normalizeLimits(plan.limits, plan.code)
  });
};

type StoredLimits = IPlan['limits'];

function mergeLimits(current: StoredLimits, incoming: NonNullable<StoredLimits>): NonNullable<StoredLimits> {
  // Read through a plain object: `current` is a Mongoose subdocument, and
  // spreading one copies its internals rather than its fields.
  const base = (current ? JSON.parse(JSON.stringify(current)) : {}) as NonNullable<StoredLimits>;
  return {
    ...base,
    ...incoming,
    meters: { ...base.meters, ...incoming.meters },
    features: { ...base.features, ...incoming.features }
  };
}
