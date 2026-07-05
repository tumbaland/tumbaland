import { Collage, CollageInput } from '../types/collage';
import { albumApi } from '../config/albumApi';
import { ApiResponse, Photo } from '../types';

export const collageService = {
  // Create a new collage
  async createCollage(collageData: CollageInput): Promise<Collage> {
    const response = await albumApi.post<ApiResponse<Collage>>('/collages', collageData);
    return response.data.data; // New format: { success: true, data: collage }
  },

  // Get all collages with optional filtering
  async getCollages(params?: { albumId?: string; groupId?: string }): Promise<Collage[]> {
    const searchParams = new URLSearchParams();
    if (params?.albumId) searchParams.set('albumId', params.albumId);
    if (params?.groupId) searchParams.set('groupId', params.groupId);

    const response = await albumApi.get<ApiResponse<Collage[]>>(`/collages?${searchParams.toString()}`);
    return response.data.data; // New format: { success: true, data: [...] }
  },

  // Get collage by ID (returns collage and albumPhotos)
  async getCollageById(id: string): Promise<{ collage: Collage; albumPhotos: Photo[] }> {
    const response = await albumApi.get<ApiResponse<{ collage: Collage; photos: Photo[] }>>(`/collages/${id}`);
    const { collage, photos } = response.data.data;
    return { collage, albumPhotos: photos }; // New format: { success: true, data: { collage, photos } }
  },

  // Update collage
  async updateCollage(id: string, collageData: CollageInput): Promise<Collage> {
    const response = await albumApi.put<ApiResponse<Collage>>(`/collages/${id}`, collageData);
    return response.data.data; // New format: { success: true, data: collage }
  },

  // Delete collage
  async deleteCollage(id: string): Promise<void> {
    await albumApi.delete(`/collages/${id}`);
  }
};
