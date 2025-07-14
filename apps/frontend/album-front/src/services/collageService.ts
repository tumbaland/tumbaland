import { Collage, CollageInput } from '../types/collage';
import { albumApi } from '../config/albumApi';

export const collageService = {
  // Create a new collage
  async createCollage(collageData: CollageInput): Promise<{ collage: Collage }> {
    const response = await albumApi.post('/collages', collageData);
    return response.data;
  },

  // Get all collages
  async getCollages(): Promise<{ collages: Collage[] }> {
    const response = await albumApi.get('/collages');
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
