import { z } from 'zod';

export const planInputSchema = z.object({
  name: z.string().min(1, 'name & code required'),
  code: z.string().min(1, 'name & code required'),
  description: z.string().optional(),
  priceMonthlyCents: z.coerce.number({ error: 'priceMonthlyCents required' }),
  priceYearlyCents: z.coerce.number().optional(),
  features: z.any().optional()
});

// createPlan accepts either a single plan object or an array (bulk-create shorthand).
export const createPlanSchema = z.union([planInputSchema, z.array(planInputSchema)]);

export const createPlansBulkSchema = z.array(planInputSchema).min(1, 'array payload required');

export const updatePlanStripePricesSchema = z.object({
  stripePriceId: z.string().min(1, 'stripePriceId required')
});

export const createOneTimePaymentSchema = z.object({
  amountCents: z.number().min(50, 'Invalid amount'),
  currency: z.string().optional()
});

export const createCheckoutSessionSchema = z.object({
  planCode: z.string().min(1, 'planCode required'),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional()
});
