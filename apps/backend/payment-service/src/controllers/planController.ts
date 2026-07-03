import { Request, Response } from 'express';
import { BadRequestError, ConflictError, NotFoundError } from '@tumbaland/core';
import { Plan, IPlan } from '../models/Plan';

export const listPlans = async (_req: Request, res: Response): Promise<void> => {
  const plans = await Plan.find({ isActive: true }).sort({ priceMonthlyCents: 1 });
  res.json({ success: true, plans });
};

// Helper validation
function validatePlanInput(p: any): { valid: boolean; message?: string } {
  if (!p) return { valid: false, message: 'empty payload' };
  if (!p.name || !p.code) return { valid: false, message: 'name & code required' };
  if (p.priceMonthlyCents == null || isNaN(Number(p.priceMonthlyCents))) return { valid: false, message: 'priceMonthlyCents required' };
  return { valid: true };
}

export const createPlan = async (req: Request, res: Response): Promise<void> => {
  // Support either a single object or an array for convenience
  if (Array.isArray(req.body)) {
    // Redirect to bulk handler semantics
    const created: IPlan[] = [];
    for (const raw of req.body) {
      const v = validatePlanInput(raw);
      if (!v.valid) { throw new BadRequestError(v.message); }
      const exists = await Plan.findOne({ code: raw.code });
      if (exists) { throw new ConflictError(`code already exists: ${raw.code}`); }
      const plan = await Plan.create(raw);
      created.push(plan);
    }
    res.status(201).json({ success: true, plans: created });
    return;
  }

  const { name, code, description, priceMonthlyCents, priceYearlyCents, features } = req.body || {};
  const v = validatePlanInput(req.body);
  if (!v.valid) { throw new BadRequestError(v.message); }
  const existing = await Plan.findOne({ code });
  if (existing) { throw new ConflictError('code already exists'); }
  const plan = await Plan.create({ name, code, description, priceMonthlyCents, priceYearlyCents, features });
  res.status(201).json({ success: true, plan });
};

export const createPlansBulk = async (req: Request, res: Response): Promise<void> => {
  if (!Array.isArray(req.body) || req.body.length === 0) {
    throw new BadRequestError('array payload required');
  }
  const payload = req.body as any[];
  // Basic validation first to fail fast
  for (const p of payload) {
    const v = validatePlanInput(p);
    if (!v.valid) { throw new BadRequestError(v.message); }
  }
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
  const { stripePriceId } = req.body || {};
  if (!stripePriceId) { throw new BadRequestError('stripePriceId required'); }
  const plan = await Plan.findOne({ code });
  if (!plan) { throw new NotFoundError('Plan not found'); }
  plan.stripePriceId = stripePriceId;
  await plan.save();
  res.json({ success: true, plan });
};
