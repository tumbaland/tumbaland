import { Schema, model, Document } from 'mongoose';

/**
 * A place a group keeps for sharing where one is: "Home", "Irja's", "Work".
 * The group's rather than one person's, so a place one of them saved is
 * there for the other to pick too.
 */
export interface ISavedPlace extends Document {
  groupId: string;
  name: string;
  lat: number;
  lng: number;
  /** The address it was saved with, shown under its name. */
  address: string;
  /** `User._id` of whoever saved it. */
  createdBy: string;
  createdAt: Date;
}

const SavedPlaceSchema = new Schema<ISavedPlace>(
  {
    groupId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    address: { type: String, default: '', maxlength: 200 },
    createdBy: { type: String, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const SavedPlace = model<ISavedPlace>('SavedPlace', SavedPlaceSchema);
