import mongoose, { Document, Schema } from 'mongoose';
import { auditPlugin } from '@tumbaland/backend-core';

export interface IAlbum extends Document {
  name: string;
  description?: string;
  coverPhotoId?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  tags: string[];
  userId: string; // User ID who created the album
  groupId?: string; // Optional group association
  // Denormalized counters, kept in sync by photoService's atomic $inc calls on
  // photo create/delete (see photoService.ts). Reading these directly is what
  // lets album listing, the album detail page, and the dashboard's storage
  // breakdown all avoid aggregating across the (much larger, ever-growing)
  // photos collection on every request.
  photoCount: number;
  totalSize: number;
}

const AlbumSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    coverPhotoId: {
      type: String,
      ref: 'Photo'
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    userId: {
      type: String,
      required: true,
      index: true
    },
    groupId: {
      type: String,
      index: true
    },
    photoCount: {
      type: Number,
      default: 0
    },
    totalSize: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Index for searching
AlbumSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Index for sorting by updatedAt (critical for performance)
AlbumSchema.index({ updatedAt: -1 });

// Support a fast, indexed "top albums by storage" query scoped to a user's
// personal albums or a single group, without scanning every album.
AlbumSchema.index({ userId: 1, totalSize: -1 });
AlbumSchema.index({ groupId: 1, totalSize: -1 });

// Attribution and a change trail; see auditPlugin.
AlbumSchema.plugin(auditPlugin, { resource: 'album' });

export default mongoose.model<IAlbum>('Album', AlbumSchema);
