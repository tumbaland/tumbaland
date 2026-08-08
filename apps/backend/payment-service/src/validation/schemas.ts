import { z } from 'zod';
import { METER_KEYS, FEATURE_KEYS, UNLIMITED } from '@tumbaland/backend-core';

/**
 * A ceiling: a whole number of bytes/items/days, or `-1` for unlimited.
 * Rejecting anything below -1 keeps "unlimited" a single value rather than a
 * range an admin has to guess at.
 */
const ceiling = z.coerce.number().int().min(UNLIMITED, 'use -1 for unlimited');

// Built from the shared key registry, and strict: an admin form that posts a
// meter nothing enforces gets a 400 naming the key, instead of a silently
// dropped field and a limit everyone believes is live.
const meterShape = Object.fromEntries(METER_KEYS.map(key => [key, ceiling.optional()]));
const featureShape = Object.fromEntries(FEATURE_KEYS.map(key => [key, z.boolean().optional()]));

export const planLimitsSchema = z.strictObject({
  meters: z.strictObject(meterShape).optional(),
  features: z.strictObject(featureShape).optional(),
  retentionDays: ceiling.optional()
});

export const planInputSchema = z.object({
  name: z.string().min(1, 'name & code required'),
  code: z.string().min(1, 'name & code required'),
  description: z.string().optional(),
  priceMonthlyCents: z.coerce.number({ error: 'priceMonthlyCents required' }),
  priceYearlyCents: z.coerce.number().optional(),
  features: z.array(z.string()).optional(),
  limits: planLimitsSchema.optional()
});

/** Partial edit of an existing plan. `code` is immutable — subscriptions denormalize it. */
export const updatePlanSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    priceMonthlyCents: z.coerce.number().min(0).optional(),
    priceYearlyCents: z.coerce.number().min(0).optional(),
    features: z.array(z.string()).optional(),
    limits: planLimitsSchema.optional(),
    isActive: z.boolean().optional(),
    isPublic: z.boolean().optional()
  })
  .refine(body => Object.keys(body).length > 0, { message: 'no updatable fields provided' });

export const updatePlanLimitsSchema = planLimitsSchema.refine(
  body => Object.keys(body).length > 0,
  { message: 'limits payload required' }
);

// createPlan accepts either a single plan object or an array (bulk-create shorthand).
export const createPlanSchema = z.union([planInputSchema, z.array(planInputSchema)]);

export const createPlansBulkSchema = z.array(planInputSchema).min(1, 'array payload required');

export const updatePlanStripePricesSchema = z.object({
  stripePriceId: z.string().min(1, 'stripePriceId required')
});

const emailField = z.email('valid email required').trim();

/** Hand a plan to someone without charging them: staff, friends, support gestures. */
export const grantSubscriptionSchema = z.object({
  email: emailField,
  planCode: z.string().min(1, 'planCode required'),
  reason: z.string().max(500).optional(),
  // ISO date. Omit for an open-ended grant.
  expiresAt: z.string().optional()
});

/** A per-user adjustment on top of the plan. `reason` is required on purpose. */
export const upsertOverrideSchema = planLimitsSchema
  .extend({
    reason: z.string().min(1, 'reason required').max(500),
    expiresAt: z.string().optional()
  })
  .refine(
    body => body.meters !== undefined || body.features !== undefined || body.retentionDays !== undefined,
    { message: 'an override must adjust at least one limit' }
  );

export const createOneTimePaymentSchema = z.object({
  amountCents: z.number().min(50, 'Invalid amount'),
  currency: z.string().optional()
});

export const createCheckoutSessionSchema = z.object({
  planCode: z.string().min(1, 'planCode required'),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional()
});
