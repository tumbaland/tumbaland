import { albumApi } from '../config/albumApi';
import { Album, CreateAlbumData, ApiResponse, PaginatedResponse, AlbumStatistics } from '../types';

export const albumService = {
  // Create a new album
  async createAlbum(albumData: CreateAlbumData & { groupId?: string }): Promise<ApiResponse<Album>> {
    const response = await albumApi.post<ApiResponse<Album>>('/albums', albumData);
    return response;
  },

  // Get all albums
  async getAlbums(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isPublic?: boolean;
    groupId?: string;
    includeCover?: boolean;
  }): Promise<PaginatedResponse<Album>> {
    const response = await albumApi.get<ApiResponse<PaginatedResponse<Album>>>('/albums', { params });
    return response.data;
  },

  // Get album by ID
  async getAlbumById(id: string): Promise<Album> {
    const response = await albumApi.get<ApiResponse<Album>>(`/albums/${id}`);
    return response.data;
  },

  // Update album
  async updateAlbum(
    id: string,
    albumData: Partial<CreateAlbumData> & { coverPhotoId?: string }
  ): Promise<ApiResponse<Album>> {
    const response = await albumApi.put<ApiResponse<Album>>(`/albums/${id}`, albumData);
    return response;
  },

  // Delete album
  async deleteAlbum(id: string): Promise<ApiResponse<void>> {
    const response = await albumApi.delete<ApiResponse<void>>(`/albums/${id}`);
    return response;
  },

  // Set cover photo for album
  async setCoverPhoto(albumId: string, photoId: string): Promise<ApiResponse<Album>> {
    const response = await albumApi.put<ApiResponse<Album>>(`/albums/${albumId}/cover`, { photoId });
    return response;
  },

  // Remove cover photo from album
  async removeCoverPhoto(albumId: string): Promise<ApiResponse<Album>> {
    const response = await albumApi.delete<ApiResponse<Album>>(`/albums/${albumId}/cover`);
    return response;
  },

  // Update photo AI analysis info
  async updatePhotoAIAnalysis(photoId: string, analysis: {
    analysisType: string;
    jobId: string;
    totalMasks?: number;
    segmentationType?: string;
    processingTime?: number;
  }): Promise<ApiResponse<unknown>> {
    const response = await albumApi.put<ApiResponse<unknown>>(`/photos/${photoId}/ai-analysis`, {
      analysisType: analysis.analysisType,
      jobId: analysis.jobId,
      totalMasks: analysis.totalMasks,
      segmentationType: analysis.segmentationType,
      processingTime: analysis.processingTime
    });
    return response;
  },

  // Get album statistics for dashboard
  async getAlbumStatistics(params?: {
    groupId?: string;
    tenantId?: string;
  }): Promise<AlbumStatistics> {
    const response = await albumApi.get<ApiResponse<AlbumStatistics>>('/statistics', { params });
    return response.data;
  }
};
