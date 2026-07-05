import { albumApi } from '../config/albumApi';
import { Photo, CreatePhotoData, PaginatedResponse, ApiResponse, UploadSignedUrlResponse } from '../types';

export const photoService = {
  // Create a new photo record
  async createPhoto(photoData: CreatePhotoData): Promise<Photo> {
    const response = await albumApi.post<ApiResponse<Photo>>('/photos', photoData);
    return response.data.data;
  },

  // Get photos by album
  async getPhotosByAlbum(
    albumId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
    }
  ): Promise<PaginatedResponse<Photo>> {
    const response = await albumApi.get<ApiResponse<PaginatedResponse<Photo>>>(`/photos/album/${albumId}`, { params });
    return response.data.data;
  },

  // Get photo by ID
  async getPhotoById(id: string): Promise<Photo> {
    const response = await albumApi.get<ApiResponse<Photo>>(`/photos/${id}`);
    return response.data.data;
  },

  // Update photo
  async updatePhoto(
    id: string,
    photoData: Partial<Pick<Photo, 'title' | 'description' | 'tags' | 'metadata'>>
  ): Promise<Photo> {
    const response = await albumApi.put<ApiResponse<Photo>>(`/photos/${id}`, photoData);
    return response.data.data;
  },

  // Delete photo
  async deletePhoto(id: string): Promise<void> {
    const response = await albumApi.delete<ApiResponse<void>>(`/photos/${id}`);
    return response.data.data;
  },

  // Get upload signed URL from album service (MinIO)
  async getUploadSignedUrl(
    filename: string,
    mimetype: string,
    albumId: string
  ): Promise<UploadSignedUrlResponse & { expiresInMinutes: number }> {
    const response = await albumApi.post<ApiResponse<UploadSignedUrlResponse & { expiresInMinutes: number }>>('/photos/upload-url', {
      filename,
      mimetype,
      albumId
    });
    return response.data.data;
  },

  // Upload file to signed URL
  async uploadFileToSignedUrl(signedUrl: string, file: File): Promise<void> {
    await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });
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
    return response.data.data;
  },

  // Utility: Load photos with signed URLs (album service now provides them directly)
  async loadPhotosWithThumbnails(
    albumId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
    }
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
