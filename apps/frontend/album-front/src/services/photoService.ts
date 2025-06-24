import { albumApi } from '../config/api';
import { 
  Photo, 
  CreatePhotoData, 
  ApiResponse, 
  PaginatedResponse,
  UploadSignedUrlResponse 
} from '../types';

export const photoService = {
  // Create a new photo record
  async createPhoto(photoData: CreatePhotoData): Promise<ApiResponse<Photo>> {
    const response = await albumApi.post('/photos', photoData);
    return response.data;
  },

  // Get photos by album
  async getPhotosByAlbum(albumId: string, params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Photo>> {
    const response = await albumApi.get(`/photos/album/${albumId}`, { params });
    return response.data;
  },

  // Get photo by ID
  async getPhotoById(id: string): Promise<ApiResponse<Photo>> {
    const response = await albumApi.get(`/photos/${id}`);
    return response.data;
  },

  // Update photo
  async updatePhoto(id: string, photoData: Partial<Pick<Photo, 'title' | 'description' | 'tags' | 'metadata'>>): Promise<ApiResponse<Photo>> {
    const response = await albumApi.put(`/photos/${id}`, photoData);
    return response.data;
  },

  // Delete photo
  async deletePhoto(id: string): Promise<ApiResponse<void>> {
    const response = await albumApi.delete(`/photos/${id}`);
    return response.data;
  },

  // Get upload signed URL
  async getUploadSignedUrl(filename: string, mimetype: string, albumId: string): Promise<ApiResponse<UploadSignedUrlResponse>> {
    const response = await albumApi.post('/photos/upload-url', {
      filename,
      mimetype,
      albumId
    });
    return response.data;
  },

  // Upload file to signed URL
  async uploadFileToSignedUrl(signedUrl: string, file: File): Promise<void> {
    await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
  }
};
