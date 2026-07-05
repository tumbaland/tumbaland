import mongoose, { Schema, Document } from 'mongoose';

/**
 * Per-scope dashboard configuration. One document per personal scope
 * (userId, no groupId) or per group scope (groupId; shared by all members).
 *
 * - highlightTypeIds: activity types featured on the dashboard — a stat card
 *   each, and the first one drives the monthly days-breakdown chart.
 * - hiddenTypeIds: activity types excluded from count-based charts (useful
 *   for presence-marker types that would otherwise dominate the numbers).
 */
export interface IDashboardSettings extends Document {
  userId: string;
  groupId?: string;
  highlightTypeIds: string[];
  hiddenTypeIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DashboardSettingsSchema: Schema = new Schema(
  {
    userId: { type: String, required: true },
    groupId: { type: String },
    highlightTypeIds: { type: [String], default: [] },
    hiddenTypeIds: { type: [String], default: [] }
  },
  {
    timestamps: true,
    collection: 'dashboard_settings'
  }
);

DashboardSettingsSchema.index({ groupId: 1 });
DashboardSettingsSchema.index({ userId: 1, groupId: 1 });

export const DashboardSettings = mongoose.model<IDashboardSettings>(
  'DashboardSettings',
  DashboardSettingsSchema
);
