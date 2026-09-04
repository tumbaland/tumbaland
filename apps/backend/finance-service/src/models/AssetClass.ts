import mongoose, { Schema, Document } from 'mongoose';
import { auditPlugin } from '@tumbaland/backend-core';

export type AssetClassKind = 'asset' | 'liability';

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