import mongoose, { Document, Schema } from 'mongoose';
import { auditPlugin } from '@tumbaland/backend-core';

export interface IPhoto extends Document {
  filename: string;
  originalName: string;
  minioFileId?: string; // MinIO storage path for original file (legacy)
  minioThumbnailFileId?: string; // MinIO storage path for thumbnail (legacy)
  albumId: string;
  title?: string;
  description?: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  tags: string[];
  metadata: {
    dateTaken?: Date;
    /**
     * Everything else the file carried. Curated by the extractor rather than the
     * schema, so a new tag is one line in the extractor and no migration here.
     */
    exif?: Record<string, string | number | boolean>;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    camera?: {
      make?: string;
      model?: string;
      settings?: {
        iso?: number;
        aperture?: string;
        shutterSpeed?: string;
        focalLength?: string;
      };
    };
  };
  /**
   * Set on a photo that came from chat. Its files belong to chat-service: the
   * album entry only points at them, so removing it from the album leaves the
   * files alone, and its bytes are metered by chat rather than a second time
   * here. Unsending the message in chat removes the entry.
   */
  source?: ChatPhotoSource | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatPhotoSource {
  kind: 'chat';
  conversationId: string;
  messageId: string;
}

const PhotoSchema: Schema = new Schema(
  {
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    minioFileId: {
      type: String,
      required: false
    },
    minioThumbnailFileId: {
      type: String,
      required: false
    },
    albumId: {
      type: Schema.Types.ObjectId,
      ref: 'Album',
      required: true
    },
    title: {
      type: String,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    width: Number,
    height: Number,
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    metadata: {
      dateTaken: Date,
      // Mixed: written once at upload from a validated, bounded payload, and
      // only ever read back whole — a declared shape would buy nothing and cost
      // a migration every time a tag is added.
      exif: { type: Schema.Types.Mixed, default: undefined },
      location: {
        latitude: Number,
        longitude: Number,
        address: String
      },
      camera: {
        make: String,
        model: String,
        settings: {
          iso: Number,
          aperture: String,
          shutterSpeed: String,
          focalLength: String
        }
      }
    },
    source: {
      type: new Schema(
        {
          kind: { type: String, enum: ['chat'], required: true },
          conversationId: { type: String, required: true },
          messageId: { type: String, required: true }
        },
        { _id: false }
      ),
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
PhotoSchema.index({ albumId: 1, createdAt: -1 });
// Unsend and "Remove from album" find a chat message's entries by its id.
PhotoSchema.index({ 'source.messageId': 1 }, { sparse: true });
PhotoSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Attribution and a change trail; see auditPlugin.
PhotoSchema.plugin(auditPlugin, { resource: 'photo', redact: ['metadata'] });

export default mongoose.model<IPhoto>('Photo', PhotoSchema);
