import mongoose, { Document, Schema } from 'mongoose';

export interface IClassAnalysis {
  name: string;
  class_id: number;
  total_pixels: number;
  pixel_percentage: number;
  frames_with_class: number;
  frame_coverage_percentage: number;
  avg_pixels_per_frame: number;
}

export interface IImageDimensions {
  width: number;
  height: number;
}

export interface IDatasetAnalysis extends Document {
  timestamp: Date;
  dataset: string; // 'waymo', 'zod', etc.
  total_frames: number;
  total_pixels: number;
  total_classes: number;
  image_dimensions: IImageDimensions;
  class_analysis: IClassAnalysis[];
  createdAt: Date;
  updatedAt: Date;
}

const ClassAnalysisSchema = new Schema({
  name: String,
  class_id: Number,
  total_pixels: Number,
  pixel_percentage: Number,
  frames_with_class: Number,
  frame_coverage_percentage: Number,
  avg_pixels_per_frame: Number
}, { _id: false });

const ImageDimensionsSchema = new Schema({
  width: Number,
  height: Number
}, { _id: false });

const DatasetAnalysisSchema: Schema = new Schema(
  {
    timestamp: {
      type: Date,
      required: true
    },
    dataset: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    total_frames: {
      type: Number,
      required: true
    },
    total_pixels: {
      type: Number,
      required: true
    },
    total_classes: {
      type: Number,
      required: true
    },
    image_dimensions: ImageDimensionsSchema,
    class_analysis: [ClassAnalysisSchema]
  },
  {
    timestamps: true
  }
);

// Indexes for performance
DatasetAnalysisSchema.index({ dataset: 1, timestamp: -1 });
DatasetAnalysisSchema.index({ timestamp: -1 });

export default mongoose.model<IDatasetAnalysis>('dataset_analysis', DatasetAnalysisSchema);
