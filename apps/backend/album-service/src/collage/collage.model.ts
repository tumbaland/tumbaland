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
  albumId: string; // New: albumId to link to album
}

export interface ICollage extends Document {
  title: string;
  config: CollageConfig;
  albumId: string; // New: albumId at root for easier querying
  ownerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CollageSchema = new Schema<ICollage>(
  {
    title: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true, default: () => ({ photos: [] }) },
    albumId: { type: String, required: true }, // New: albumId at root
    ownerId: { type: String }
  },
  { timestamps: true }
);

export const CollageModel = mongoose.model<ICollage>('Collage', CollageSchema);
