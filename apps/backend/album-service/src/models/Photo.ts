import mongoose, { Document, Schema } from 'mongoose';

export interface IPhoto extends Document {
  filename: string;
  originalName: string;
  fileId: string; // Reference to file-service file ID
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
    fileId: {
      type: String,
      required: true,
      unique: true
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
