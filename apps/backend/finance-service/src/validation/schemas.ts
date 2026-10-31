import { z } from 'zod';

/** ISO 4217: three letters, stored and compared uppercase. */
const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO code');

/** ISO 6166: two letters, nine letters or digits, a check digit. Empty clears it. */
const isinSchema = z.union([
  z.literal(''),
  z.string().trim().toUpperCase().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, 'isin must be a 12-character ISIN')
]);

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
  isin: isinSchema.optional(),
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

/**
 * `matchType` defaults to a folded substring test, so a pattern is the merchant
 * name as it reads on the statement — which is all the UI ever writes. `regex`
 * is for the rules migrated out of source, whose lookaheads and word boundaries
 * no substring can express.
 */
export const createCategoryRuleSchema = z.object({
  pattern: z.string().trim().min(1, 'pattern is required'),
  matchType: z.enum(['text', 'regex']).default('text'),
  category: z.string().trim().min(1, 'category is required'),
  type: z.enum(['income', 'expense']).optional(),
  note: z.string().trim().optional()
});

/**
 * `type: null` clears the direction restriction — distinct from omitting it,
 * which leaves the restriction as it was.
 */
export const updateCategoryRuleSchema = z.object({
  pattern: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  type: z.enum(['income', 'expense']).nullable().optional(),
  note: z.string().trim().optional()
});

export const moveCategoryRuleSchema = z.object({
  direction: z.enum(['up', 'down'])
});

export const applyCategoryRulesSchema = z.object({
  // Defaulted on rather than off: re-filing rows the owner sorted by hand is
  // the destructive reading, and it should have to be asked for.
  onlyUncategorised: z.boolean().default(true)
});


/**
 * Plain names, not patterns — matching folds accents, ignores case and
 * collapses whitespace, so nothing typed here is ever compiled.
 */
export const updateStatementSettingsSchema = z.object({
  ownerNames: z.array(z.string().trim().min(1)).max(20)
});
