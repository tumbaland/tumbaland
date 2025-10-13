import { visionApi } from '../config/visionApi';
import {
  Dataset,
  CreateDatasetData,
  ApiResponse,
  PaginatedResponse
} from '../types';

export const datasetService = {
  // Get all datasets
  async getDatasets(params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Dataset>> {
    const response = await visionApi.get('/datasets', { params });
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
  },

  // Create dataset
  async createDataset(datasetData: CreateDatasetData): Promise<ApiResponse<Dataset>> {
    const response = await visionApi.post('/datasets', datasetData);
    return response.data;
  },

  // Update dataset
  async updateDataset(id: string, datasetData: Partial<CreateDatasetData>): Promise<ApiResponse<Dataset>> {
    const response = await visionApi.put(`/datasets/${id}`, datasetData);
    return response.data;
  },

  // Delete dataset
  async deleteDataset(id: string): Promise<ApiResponse<void>> {
    const response = await visionApi.delete(`/datasets/${id}`);
    return response.data;
  }
};
