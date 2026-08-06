import { z } from 'zod';

/** ISO 4217: three letters, stored and compared uppercase. */
const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO code');

export const createHoldingSchema = z.object({
  ticker: z.string().min(1),
  displayName: z.string().optional(),
  currency: currencySchema.optional(),
  quantity: z.number(),
  avgBuyPrice: z.number(),
  buyDate: z.iso.date().optional(),
  notes: z.string().optional(),
  groupId: z.string().optional()
});

export const updateHoldingSchema = createHoldingSchema.partial();

export const createTrackedTickerSchema = z.object({
  ticker: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  currency: currencySchema.optional(),
  isActive: z.boolean().optional(),
  groupId: z.string().optional()
});

export const updateTrackedTickerSchema = createTrackedTickerSchema.partial();

export const createAssetClassSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  kind: z.enum(['asset', 'liability']).optional(),
  groupId: z.string().optional()
});

export const updateAssetClassSchema = createAssetClassSchema.partial();

export const upsertSnapshotSchema = z.object({
  entries: z.array(z.object({
    assetClassId: z.string().min(1),
    value: z.number().min(0),
    gain: z.number().default(0)
  })).min(1, 'At least one entry is required'),
  groupId: z.string().optional()
});

export const tickerFetchSchema = z.object({
  ticker: z.string().min(1, 'ticker is required')
});

export const createTradeSchema = z.object({
  ticker: z.string().trim().min(1),
  type: z.enum(['buy', 'sell', 'dividend', 'fee']),
  date: z.iso.date(),
  // Share-level fields for buy/sell, cash total for dividend/fee. Which
  // combination a given type requires is enforced in the service, where the
  // partial-update case can see the merged document.
  quantity: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  amount: z.number().min(0).optional(),
  fees: z.number().min(0).optional(),
  notes: z.string().optional(),
  groupId: z.string().optional()
});

export const updateTradeSchema = createTradeSchema.partial();

export const createTransactionSchema = z.object({
  date: z.iso.date(),
  // A positive magnitude; direction lives in `type`.
  amount: z.number().min(0),
  type: z.enum(['income', 'expense']),
  category: z.string().trim().min(1),
  note: z.string().optional(),
  groupId: z.string().optional()
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const createBudgetSchema = z.object({
  category: z.string().trim().min(1),
  amount: z.number().min(0),
  groupId: z.string().optional()
});

export const updateBudgetSchema = createBudgetSchema.partial();
