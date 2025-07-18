import { albumApi } from '../config/albumApi';
import { ApiResponse } from '../types';

export const aiService = {
  // ML Analysis endpoints (placeholders for future implementation)
  async runImageClassification(photoId: string): Promise<ApiResponse<any>> {
    const response = await albumApi.post(`/photos/${photoId}/analyze/classification`);
    return response.data;
  },

  async runObjectDetection(photoId: string): Promise<ApiResponse<any>> {
    const response = await albumApi.post(`/photos/${photoId}/analyze/detection`);
    return response.data;
  },

  async runSemanticSegmentation(photoId: string): Promise<ApiResponse<any>> {
    const response = await albumApi.post(`/photos/${photoId}/analyze/segmentation`);
    return response.data;
  },

  async generateAutoTags(photoId: string): Promise<ApiResponse<any>> {
    const response = await albumApi.post(`/photos/${photoId}/analyze/tags`);
    return response.data;
  }
};
