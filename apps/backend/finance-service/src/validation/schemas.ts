import { z } from 'zod';

export const createUserPortfolioSchema = z.object({
  symbol: z.string().min(1),
  quantity: z.number(),
  avgBuyPrice: z.number(),
  buyDate: z.iso.date().optional(),
  notes: z.string().optional(),
  groupId: z.string().optional()
});

export const updateUserPortfolioSchema = createUserPortfolioSchema.partial();

export const createTrackedTickerSchema = z.object({
  ticker: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  groupId: z.string().optional()
});

export const updateTrackedTickerSchema = createTrackedTickerSchema.partial();

export const createAssetClassSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  groupId: z.string().optional()
});

export const updateAssetClassSchema = createAssetClassSchema.partial();

export const createAssetAllocationSchema = z.object({
  assetClassId: z.string().min(1),
  totalValue: z.number().min(0),
  gain: z.number(),
  date: z.coerce.date({ error: 'A valid date is required' }),
  groupId: z.string().optional()
});

export const updateAssetAllocationSchema = createAssetAllocationSchema.partial();

export const tickerFetchSchema = z.object({
  ticker: z.string().min(1, 'ticker is required')
});
