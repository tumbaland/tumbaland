import mongoose, { Schema, Document } from 'mongoose';

/**
 * Per-scope dashboard configuration. One document per personal scope
 * (userId, no groupId) or per group scope (groupId; shared by all members).
 *
 * - highlightTypeIds: activity types featured on the dashboard — a stat card
 *   each, and the first one drives the monthly days-breakdown chart.
 * - hiddenTypeIds: activity types excluded from count-based charts (useful
 *   for presence-marker types that would otherwise dominate the numbers).
 * - startDate: the day the "days together" count runs from. Absent means the
 *   count falls back to the first logged entry, which is rarely the real start.
 */
export interface IDashboardSettings extends Document {
  userId: string;
  groupId?: string;
  highlightTypeIds: string[];
  hiddenTypeIds: string[];
  /** YYYY-MM-DD; a plain day string, never a timestamp to shift across zones */
  startDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DashboardSettingsSchema: Schema = new Schema(
  {
    userId: { type: String, required: true },
    groupId: { type: String },
    highlightTypeIds: { type: [String], default: [] },
    hiddenTypeIds: { type: [String], default: [] },
    startDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ }
  },
  {
    timestamps: true,
    collection: 'dashboard_settings'
  }
);

// One settings document per scope and every read is a findOne on that scope,
// never a sorted range — so these two equality indexes are all this needs.
DashboardSettingsSchema.index({ groupId: 1 });
DashboardSettingsSchema.index({ userId: 1, groupId: 1 });

export const DashboardSettings = mongoose.model<IDashboardSettings>(
  'DashboardSettings',
  DashboardSettingsSchema
);
