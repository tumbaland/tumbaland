import mongoose, { Document, Schema } from 'mongoose';

export interface CollageConfig {
  version: string;
  date: string;
  viewport: {
    width: number;
    height: number;
  };
  theme: string;
  photos: Array<{
    filename: string;
    caption: string;
    position: {
      left: number;
      top: number;
    };
    width: number;
    height: number;
    rotation: number;
    frameVisible: boolean;
    scaleX: string;
    scaleY: string;
  }>;
  textSections: Array<any>;
  title: {
    text: string;
    subtitle: string;
  };
  albumIds: string[]; // Updated: albumIds array to support multiple albums
}

export interface ICollage extends Document {
  title: string;
  config: CollageConfig;
  albumIds: string[]; // Updated: albumIds array for multiple albums
  userId?: string; // User ID who created the collage
  groupId?: string; // Optional group association
  createdAt: Date;
  updatedAt: Date;
}

const CollageSchema = new Schema<ICollage>(
  {
    title: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true, default: () => ({ photos: [] }) },
    albumIds: { type: [String], required: true }, // Updated: albumIds as array
    userId: { type: String, index: true },
    groupId: { type: String, index: true }
  },
  { timestamps: true }
);

export const CollageModel = mongoose.model<ICollage>('Collage', CollageSchema);
