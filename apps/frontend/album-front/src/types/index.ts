export type GridDensity = 'large' | 'comfortable' | 'compact' | 'tiny';

export interface Album {
  _id: string;
  name: string;
  description?: string;
  coverPhotoId?: string;
  coverPhoto?: Photo;
  isPublic: boolean;
  tags: string[];
  photoCount: number;
  totalSize: number;
  userId: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  _id: string;
  filename: string;
  originalName: string;
  minioFileId?: string;
  minioThumbnailFileId?: string;
  albumId: string;
  title?: string;
  description?: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  tags: string[];
  signedUrl?: string;
  signedUrlExpiresAt?: string;
  signedUrlExpiresInMinutes?: number;
  thumbnailSignedUrl?: string; // Add thumbnail signed URL
  thumbnailSignedUrlExpiresAt?: string;
  thumbnailSignedUrlExpiresInMinutes?: number;
  thumbnailUrl?: string; // Add thumbnail URL for efficient grid loading
  // Optional: a Mongoose single-nested-subdocument path that was never set
  // (e.g. a photo created before this field existed) serializes as absent
  // from the API response, not as `{}` — see PhotoViewer's buildDetails.
  metadata?: {
    dateTaken?: string;
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
      analyzedAt: string;
      totalDetections: number;
      processingTime: number;
    };
    segmentation?: {
      jobId: string;
      analyzedAt: string;
      totalMasks: number;
      segmentationType: 'automatic' | 'prompted' | 'error';
      processingTime: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface MemoryPhoto extends Photo {
  /** the album the photo lives in, so the strip can say where it came from */
  albumName: string;
  /** the day this photo is remembered on (YYYY-MM-DD) */
  memoryDate: string;
  /** 'taken' when the file carried a capture date, 'uploaded' when it did not */
  dateSource: 'taken' | 'uploaded';
}

export interface MemoryYear {
  year: number;
  yearsAgo: number;
  /** photos this year has on the day — may exceed `photos.length` */
  photoCount: number;
  photos: MemoryPhoto[];
}

export interface Memories {
  /** the day the window is centred on (YYYY-MM-DD) */
  date: string;
  windowDays: number;
  totalPhotos: number;
  /** most recent year first */
  years: MemoryYear[];
}

export interface CreateAlbumData {
  name: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  groupId?: string;
}

export interface CreatePhotoData {
  filename: string;
  originalName: string;
  minioFileId: string;
  albumId: string;
  title?: string;
  description?: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  tags?: string[];
  metadata?: Photo['metadata'];
}

/** A tag with how many photos in the album carry it. */
export interface TagCount {
  tag: string;
  count: number;
}

/** 'all' narrows with every added tag; 'any' widens to their union. */
export type TagMatch = 'any' | 'all';

export interface BulkTagResult {
  matched: number;
  modified: number;
  tags: TagCount[];
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  albums?: T[];
  photos?: T[];
  pagination: PaginationInfo;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface AlbumStatistics {
  overview: {
    totalAlbums: number;
    totalPhotos: number;
    totalStorage: number;
    averagePhotoSize: number;
  };
  timeSeries: {
    albumsCreated: Array<{
      date: string;
      count: number;
    }>;
    photosUploaded: Array<{
      date: string;
      count: number;
    }>;
  };
  tags: Array<{
    tag: string;
    count: number;
  }>;
  aiAnalysis: {
    totalPhotos: number;
    analyzedPhotos: number;
    analysisRate: number;
    totalDetections: number;
    totalMasks: number;
  };
  groups: Array<{
    groupId: string;
    albumCount: number;
    photoCount: number;
  }>;
  albums: Array<{
    albumId: string;
    name: string;
    totalSize: number;
    photoCount: number;
  }>;
}

export interface UploadSignedUrlResponse {
  uploadUrl: string;
  minioFileId: string;
  albumId: string;
}

// Auth types
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthResponse {
  authenticated: boolean;
  user: User | null;
}
