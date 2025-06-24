import mongoose, { Document, Schema } from 'mongoose';

export interface IAlbum extends Document {
  name: string;
  description?: string;
  coverPhotoId?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  tags: string[];
}

const AlbumSchema: Schema = new Schema({
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
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Index for searching
AlbumSchema.index({ name: 'text', description: 'text', tags: 'text' });

export default mongoose.model<IAlbum>('Album', AlbumSchema);
