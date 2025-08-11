import { Request, Response } from 'express';
import { Plan, IPlan } from '../models/Plan';

export const listPlans = (_req: Request, res: Response): void => {
  (async () => {
    const plans = await Plan.find({ isActive: true }).sort({ priceMonthlyCents: 1 });
    res.json({ success: true, plans });
  })().catch(err => {
    console.error('listPlans error', err);
    res.status(500).json({ success: false, message: 'internal error' });
  });
};

// Helper validation
function validatePlanInput(p: any): { valid: boolean; message?: string } {
  if (!p) return { valid: false, message: 'empty payload' };
  if (!p.name || !p.code) return { valid: false, message: 'name & code required' };
  if (p.priceMonthlyCents == null || isNaN(Number(p.priceMonthlyCents))) return { valid: false, message: 'priceMonthlyCents required' };
  return { valid: true };
}

export const createPlan = (req: Request, res: Response): void => {
  (async () => {
    // Support either a single object or an array for convenience
    if (Array.isArray(req.body)) {
      // Redirect to bulk handler semantics
      const created: IPlan[] = [];
      for (const raw of req.body) {
        const v = validatePlanInput(raw);
        if (!v.valid) { res.status(400).json({ success: false, message: v.message }); return; }
        const exists = await Plan.findOne({ code: raw.code });
        if (exists) { res.status(409).json({ success: false, message: `code already exists: ${raw.code}` }); return; }
        const plan = await Plan.create(raw);
        created.push(plan);
      }
      res.status(201).json({ success: true, plans: created });
      return;
    }

    const { name, code, description, priceMonthlyCents, priceYearlyCents, features } = req.body || {};
    const v = validatePlanInput(req.body);
    if (!v.valid) { res.status(400).json({ success: false, message: v.message }); return; }
    const existing = await Plan.findOne({ code });
    if (existing) { res.status(409).json({ success: false, message: 'code already exists' }); return; }
    const plan = await Plan.create({ name, code, description, priceMonthlyCents, priceYearlyCents, features });
    res.status(201).json({ success: true, plan });
  })().catch(err => {
    console.error('createPlan error', err);
    res.status(500).json({ success: false, message: 'internal error' });
  });
};

export const createPlansBulk = (req: Request, res: Response): void => {
  (async () => {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      res.status(400).json({ success: false, message: 'array payload required' }); return;
    }
    const payload = req.body as any[];
    // Basic validation first to fail fast
    for (const p of payload) {
      const v = validatePlanInput(p);
      if (!v.valid) { res.status(400).json({ success: false, message: v.message }); return; }
    }
    // Check duplicates in request
    const codes = payload.map(p => p.code);
    const dupInRequest = codes.find((c, idx) => codes.indexOf(c) !== idx);
    if (dupInRequest) { res.status(400).json({ success: false, message: `duplicate code in payload: ${dupInRequest}` }); return; }
    // Check existing
    const existing = await Plan.find({ code: { $in: codes } }, { code: 1 }).lean();
    if (existing.length) { res.status(409).json({ success: false, message: `codes already exist: ${existing.map(e => e.code).join(',')}` }); return; }
    const created = await Plan.insertMany(payload);
    res.status(201).json({ success: true, plans: created });
  })().catch(err => {
    console.error('createPlansBulk error', err);
    res.status(500).json({ success: false, message: 'internal error' });
  });
};

export const updatePlanStripePrices = (req: Request, res: Response): void => {
  (async () => {
    const { code } = req.params as { code: string };
    const { stripePriceId } = req.body || {};
    if (!stripePriceId) { res.status(400).json({ success: false, message: 'stripePriceId required' }); return; }
    const plan = await Plan.findOne({ code });
    if (!plan) { res.status(404).json({ success: false, message: 'plan not found' }); return; }
    plan.stripePriceId = stripePriceId;
    await plan.save();
    res.json({ success: true, plan });
  })().catch(err => { console.error('updatePlanStripePrices error', err); res.status(500).json({ success: false, message: 'internal error' }); });
};
