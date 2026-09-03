import mongoose, { Document, Schema } from 'mongoose';

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
  aiAnalysis?: {
    objectDetection?: {
      jobId: string;
      analyzedAt: Date;
      totalDetections: number;
      processingTime: number;
    };
    segmentation?: {
      jobId: string;
      analyzedAt: Date;
      totalMasks: number;
      segmentationType: 'prompted' | 'automatic';
      processingTime: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
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
    aiAnalysis: {
      objectDetection: {
        jobId: {
          type: String,
          required: false
        },
        analyzedAt: {
          type: Date,
          required: false
        },
        totalDetections: {
          type: Number,
          required: false
        },
        processingTime: {
          type: Number,
          required: false
        }
      },
      segmentation: {
        jobId: {
          type: String,
          required: false
        },
        analyzedAt: {
          type: Date,
          required: false
        },
        totalMasks: {
          type: Number,
          required: false
        },
        segmentationType: {
          type: String,
          enum: ['prompted', 'automatic'],
          required: false
        },
        processingTime: {
          type: Number,
          required: false
        }
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
PhotoSchema.index({ albumId: 1, createdAt: -1 });
PhotoSchema.index({ title: 'text', description: 'text', tags: 'text' });

export default mongoose.model<IPhoto>('Photo', PhotoSchema);
