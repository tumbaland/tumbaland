import { albumApi } from '../config/albumApi';
import { 
  Album, 
  CreateAlbumData, 
  ApiResponse, 
  PaginatedResponse 
} from '../types';

export const albumService = {
  // Create a new album
  async createAlbum(albumData: CreateAlbumData): Promise<ApiResponse<Album>> {
    const response = await albumApi.post('/albums', albumData);
    return response.data;
  },

  // Get all albums
  async getAlbums(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isPublic?: boolean;
  }): Promise<PaginatedResponse<Album>> {
    const response = await albumApi.get('/albums', { params });
    return response.data;
  },

  // Get album by ID
  async getAlbumById(id: string): Promise<ApiResponse<Album>> {
    const response = await albumApi.get(`/albums/${id}`);
    return response.data;
  },

  // Update album
  async updateAlbum(id: string, albumData: Partial<CreateAlbumData> & { coverPhotoId?: string }): Promise<ApiResponse<Album>> {
    const response = await albumApi.put(`/albums/${id}`, albumData);
    return response.data;
  },

  // Delete album
  async deleteAlbum(id: string): Promise<ApiResponse<void>> {
    const response = await albumApi.delete(`/albums/${id}`);
    return response.data;
  },

  // Set cover photo for album
  async setCoverPhoto(albumId: string, photoId: string): Promise<ApiResponse<Album>> {
    const response = await albumApi.put(`/albums/${albumId}/cover`, { photoId });
    return response.data;
  },

  // Remove cover photo from album
  async removeCoverPhoto(albumId: string): Promise<ApiResponse<Album>> {
    const response = await albumApi.delete(`/albums/${albumId}/cover`);
    return response.data;
  }
};
