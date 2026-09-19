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

/**
 * What a photo file told us about itself. Everything is optional: plenty of
 * files arrive with no EXIF at all — screenshots, scans, anything that has been
 * through a messaging app.
 */
export interface PhotoMetadata {
  /** ISO instant whose UTC calendar date is the day the photo was taken */
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
  /**
   * Everything else the file carried, kept for features that do not exist yet.
   * Deliberately open-ended — the extractor curates what goes in, so widening it
   * later costs a tag in one list rather than a migration.
   */
  exif?: Record<string, unknown>;
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
  metadata?: PhotoMetadata;
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

/** A photo in one of the dashboard strips: recent uploads, or the random pick. */
export interface HighlightPhoto extends Photo {
  /** the album the photo lives in, so a tile can say where it came from */
  albumName: string;
  /** its capture date if the file carried one, otherwise when it was uploaded */
  takenAt: string;
  /** 'taken' when the file carried a capture date, 'uploaded' when it did not */
  dateSource: 'taken' | 'uploaded';
}

export interface Highlights {
  photos: HighlightPhoto[];
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
