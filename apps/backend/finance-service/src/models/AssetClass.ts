import mongoose, { Schema, Document } from 'mongoose';
import { auditPlugin } from '@tumbaland/backend-core';

export type AssetClassKind = 'asset' | 'liability';

/**
 * How reachable the money in a class is:
 *   cash    — spendable now, what a gap in income is covered from
 *   market  — can be sold within days, at whatever the market pays that week
 *   locked  — takes years or a penalty to reach: pensions, property
 * Unset on classes created before the field existed, which are shown as
 * unsorted rather than guessed at from their names.
 */
export type AssetClassLiquidity = 'cash' | 'market' | 'locked';

export interface IAssetClass extends Document {
  name: string;
  description?: string;
  color?: string; // Default color for charts
  /**
   * Whether entries in this class add to or subtract from net worth. Snapshot
   * values stay positive magnitudes either way — a €94 100 mortgage is entered
   * as 94 100 in a liability class, not as -94 100 in an asset one — which
   * keeps the allocation breakdown and the percentage bars meaningful.
   */
  kind: AssetClassKind;
  liquidity?: AssetClassLiquidity;
  userId: string; // User ID who created the asset class
  groupId?: string; // Optional group association
  createdAt: Date;
  updatedAt: Date;
}

const AssetClassSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  kind: {
    type: String,
    enum: ['asset', 'liability'],
    default: 'asset',
    required: true
  },
  liquidity: {
    type: String,
    enum: ['cash', 'market', 'locked']
  },
  color: {
    type: String,
    trim: true,
    default: '#667eea' // Default color
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  groupId: {
    type: String,
    index: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Attribution and a change trail; see auditPlugin.
AssetClassSchema.plugin(auditPlugin, { resource: 'asset_class' });

export default mongoose.model<IAssetClass>('AssetClass', AssetClassSchema);