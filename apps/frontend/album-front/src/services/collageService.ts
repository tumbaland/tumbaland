import { Collage, CollageInput } from '../types/collage';
import { albumApi } from '../config/albumApi';

export const collageService = {
  // Create a new collage
  async createCollage(collageData: CollageInput): Promise<{ collage: Collage }> {
    const response = await albumApi.post('/collages', collageData);
    return response.data;
  },

  // Get all collages with optional filtering
  async getCollages(params?: { albumId?: string; groupId?: string }): Promise<{ collages: Collage[] }> {
    const searchParams = new URLSearchParams();
    if (params?.albumId) searchParams.set('albumId', params.albumId);
    if (params?.groupId) searchParams.set('groupId', params.groupId);
    
    const response = await albumApi.get(`/collages?${searchParams.toString()}`);
    return response.data;
  },

  // Get collage by ID (returns collage and albumPhotos)
  async getCollageById(id: string): Promise<{ collage: Collage; albumPhotos: any[] }> {
    const response = await albumApi.get(`/collages/${id}`);
    return response.data;
  },

  // Update collage
  async updateCollage(id: string, collageData: CollageInput): Promise<{ collage: Collage }> {
    const response = await albumApi.put(`/collages/${id}`, collageData);
    return response.data;
  },

  // Delete collage
  async deleteCollage(id: string): Promise<void> {
    await albumApi.delete(`/collages/${id}`);
  }
};
