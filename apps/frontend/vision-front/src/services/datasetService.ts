import { visionApi } from '../config/visionApi';
import {
  ApiResponse,
  PaginatedResponse
} from '../types';

export interface Dataset {
  _id: string;
  uuid: string;
  name: string;
  description?: string;
  timestamp: string;
  dataset_info?: Record<string, any>;
  annotations?: Record<string, any>;
  camera?: Record<string, any>;
  lidar?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export const datasetService = {
  // Get all datasets
  async getDatasets(params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Dataset>> {
    const response = await visionApi.get(`/datasets`, { params });
    return response.data;
  },

  // Get dataset by ID
  async getDatasetById(id: string): Promise<ApiResponse<Dataset>> {
    const response = await visionApi.get(`/datasets/${id}`);
    return response.data;
  },

  // Get dataset by UUID
  async getDatasetByUuid(uuid: string): Promise<ApiResponse<Dataset>> {
    const response = await visionApi.get(`/datasets/uuid/${uuid}`);
    return response.data;
  }
};
