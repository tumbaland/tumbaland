export interface Album {
  _id: string;
  name: string;
  description?: string;
  coverPhotoId?: string;
  coverPhoto?: Photo;
  isPublic: boolean;
  tags: string[];
  photoCount: number;
  userId: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  _id: string;
  filename: string;
  originalName: string;
  fileId: string;
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
  metadata: {
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
      resultId: string;
      analyzedAt: string;
      totalDetections: number;
      processingTime: number;
    };
    segmentation?: {
      resultId: string;
      analyzedAt: string;
      totalMasks: number;
      segmentationType: 'automatic' | 'prompted' | 'error';
      processingTime: number;
    };
  };
  createdAt: string;
  updatedAt: string;
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
  fileId: string;
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

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    albums?: T[];
    photos?: T[];
    pagination: PaginationInfo;
  };
}

export interface UploadSignedUrlResponse {
  uploadUrl: string;
  fileId: string;
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
