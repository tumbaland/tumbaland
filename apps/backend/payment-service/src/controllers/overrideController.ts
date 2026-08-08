import { Request, Response } from 'express';
import { logger, BadRequestError, NotFoundError } from '@tumbaland/backend-core';
import { EntitlementOverride } from '../models/EntitlementOverride';
import { resolveEntitlements } from '../services/entitlementService';

/**
 * Per-user limit adjustments. The tool for "give this friend 20 GB" — a bump on
 * top of whatever plan they are on, rather than a different plan.
 */

export const listOverrides = async (_req: Request, res: Response): Promise<void> => {
  const overrides = await EntitlementOverride.find({}).sort({ createdAt: -1 });
  res.json({ success: true, overrides });
};

export const getOverride = async (req: Request, res: Response): Promise<void> => {
  const userEmail = String(req.params.email ?? '').trim().toLowerCase();
  const override = await EntitlementOverride.findOne({ userEmail });
  if (!override) { throw new NotFoundError('No override for that user'); }

  // The resolved limits alongside the raw override, so an admin sees the effect
  // rather than having to layer plan and override in their head.
  const { limits, planCode } = await resolveEntitlements(userEmail);
  res.json({ success: true, override, planCode, effectiveLimits: limits });
};

export const upsertOverride = async (req: Request, res: Response): Promise<void> => {
  const userEmail = String(req.params.email ?? '').trim().toLowerCase();
  const { meters, features, retentionDays, reason, expiresAt } = req.body;

  const expires = expiresAt ? new Date(expiresAt) : undefined;
  if (expires && Number.isNaN(expires.getTime())) { throw new BadRequestError('expiresAt is not a valid date'); }

  // Replace, not merge. An override is small and read whole, and a merging PUT
  // gives no way to *remove* a single adjustment — the field would just be
  // absent from the body and keep its old value forever.
  const override = await EntitlementOverride.findOneAndReplace(
    { userEmail },
    { userEmail, meters, features, retentionDays, reason, expiresAt: expires, grantedBy: req.user!.email },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  logger.info('[upsertOverride] Entitlement override set', {
    userEmail,
    grantedBy: req.user!.email,
    reason,
    expiresAt: expires
  });

  const { limits, planCode } = await resolveEntitlements(userEmail);
  res.json({ success: true, override, planCode, effectiveLimits: limits });
};

export const deleteOverride = async (req: Request, res: Response): Promise<void> => {
  const userEmail = String(req.params.email ?? '').trim().toLowerCase();
  const deleted = await EntitlementOverride.findOneAndDelete({ userEmail });
  if (!deleted) { throw new NotFoundError('No override for that user'); }

  logger.info('[deleteOverride] Entitlement override removed', { userEmail, removedBy: req.user!.email });

  const { limits, planCode } = await resolveEntitlements(userEmail);
  res.json({ success: true, planCode, effectiveLimits: limits });
};
