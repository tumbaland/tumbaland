import { z } from 'zod';

export const createHoldingSchema = z.object({
  ticker: z.string().min(1),
  displayName: z.string().optional(),
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
