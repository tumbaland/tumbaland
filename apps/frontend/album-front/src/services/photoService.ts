import { albumApi } from './albumApi';
import {
  Photo,
  CreatePhotoData,
  PaginatedResponse,
  ApiResponse,
  UploadSignedUrlResponse,
  BulkTagResult,
  TagCount,
  TagMatch
} from '../types';

export interface PhotoQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
  tagMatch?: TagMatch;
}

/**
 * `tags` travels as a comma-joined value; the array itself would serialize as
 * `tags[]=` through the api client's param handling.
 */
const toRequestParams = (params?: PhotoQueryParams) => {
  if (!params) return undefined;
  const { tags, tagMatch, ...rest } = params;
  if (!tags || tags.length === 0) return rest;
  return { ...rest, tags: tags.join(','), tagMatch: tagMatch ?? 'all' };
};

export const photoService = {
  // Create a new photo record
  async createPhoto(photoData: CreatePhotoData): Promise<Photo> {
    const response = await albumApi.post<ApiResponse<Photo>>('/photos', photoData);
    return response.data;
  },

  // Get photos by album
  async getPhotosByAlbum(albumId: string, params?: PhotoQueryParams): Promise<PaginatedResponse<Photo>> {
    const response = await albumApi.get<ApiResponse<PaginatedResponse<Photo>>>(`/photos/album/${albumId}`, {
      params: toRequestParams(params)
    });
    return response.data;
  },

  // List every tag used in an album, most used first
  async getAlbumTags(albumId: string): Promise<TagCount[]> {
    const response = await albumApi.get<ApiResponse<{ tags: TagCount[] }>>(`/photos/album/${albumId}/tags`);
    return response.data.tags;
  },

  // Add and/or remove tags across many photos in one request
  async bulkUpdateTags(photoIds: string[], changes: { add?: string[]; remove?: string[] }): Promise<BulkTagResult> {
    const response = await albumApi.put<ApiResponse<BulkTagResult>>('/photos/tags', {
      photoIds,
      add: changes.add,
      remove: changes.remove
    });
    return response.data;
  },

  // Get photo by ID
  async getPhotoById(id: string): Promise<Photo> {
    const response = await albumApi.get<ApiResponse<Photo>>(`/photos/${id}`);
    return response.data;
  },

  // Update photo
  async updatePhoto(
    id: string,
    photoData: Partial<Pick<Photo, 'title' | 'description' | 'tags' | 'metadata'>>
  ): Promise<Photo> {
    const response = await albumApi.put<ApiResponse<Photo>>(`/photos/${id}`, photoData);
    return response.data;
  },

  // Delete photo
  async deletePhoto(id: string): Promise<void> {
    const response = await albumApi.delete<ApiResponse<void>>(`/photos/${id}`);
    return response.data;
  },

  // Get upload signed URL from album service (MinIO).
  //
  // `sizeBytes` is what the storage quota is checked against: this request is
  // the last point where the size is known before the bytes are written, so a
  // plan that has run out of storage is refused here with a 402 rather than
  // after the file has already landed in MinIO.
  async getUploadSignedUrl(
    filename: string,
    mimetype: string,
    albumId: string,
    sizeBytes: number
  ): Promise<UploadSignedUrlResponse & { expiresInMinutes: number }> {
    const response = await albumApi.post<ApiResponse<UploadSignedUrlResponse & { expiresInMinutes: number }>>('/photos/upload-url', {
      filename,
      mimetype,
      albumId,
      sizeBytes
    });
    return response.data;
  },

  // Upload file to signed URL
  async uploadFileToSignedUrl(signedUrl: string, file: File): Promise<void> {
    const response = await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });

    if (!response.ok) {
      throw new Error(`File upload failed with status ${response.status}`);
    }
  },

  // AI Analysis methods
  async updatePhotoAIAnalysis(
    photoId: string,
    analysisData: {
      analysisType: 'objectDetection' | 'segmentation';
      resultId: string;
      totalDetections?: number;
      totalMasks?: number;
      segmentationType?: 'prompted' | 'automatic';
      processingTime: number;
    }
  ): Promise<Photo> {
    const response = await albumApi.put<ApiResponse<Photo>>(`/photos/${photoId}/ai-analysis`, analysisData);
    return response.data;
  },

  // Utility: Load photos with signed URLs (album service now provides them directly)
  async loadPhotosWithThumbnails(
    albumId: string,
    params?: PhotoQueryParams
  ): Promise<PaginatedResponse<Photo & { thumbnailUrl?: string; fileUrl?: string }>> {
    // Get photos from album service - it now includes signed URLs directly
    const photosResponse = await this.getPhotosByAlbum(albumId, params);
    const photos = photosResponse.photos || [];

    // The album service already provides signed URLs, so we just need to map them
    const photosWithUrls = photos.map(photo => ({
      ...photo,
      thumbnailUrl: photo.thumbnailSignedUrl || undefined, // Only use thumbnail if signed URL exists
      fileUrl: photo.signedUrl // Full resolution URL
    }));

    return {
      ...photosResponse,
      photos: photosWithUrls
    };
  },
};
