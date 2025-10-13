import { visionApi } from '../config/visionApi';
import {
  Epoch,
  CreateEpochData,
  ApiResponse,
  PaginatedResponse
} from '../types';

export const epochService = {
  // Get epochs by training
  async getEpochsByTraining(trainingId: string, params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Epoch>> {
    const response = await visionApi.get(`/epochs/training/${trainingId}`, { params });
    return response.data;
  },

  // Get epoch by ID
  async getEpochById(id: string): Promise<ApiResponse<Epoch>> {
    const response = await visionApi.get(`/epochs/${id}`);
    return response.data;
  },

  // Get epoch by UUID
  async getEpochByUuid(uuid: string): Promise<ApiResponse<Epoch>> {
    const response = await visionApi.get(`/epochs/uuid/${uuid}`);
    return response.data;
  },

  // Create epoch
  async createEpoch(epochData: CreateEpochData): Promise<ApiResponse<Epoch>> {
    const response = await visionApi.post('/epochs', epochData);
    return response.data;
  },

  // Create multiple epochs (batch)
  async createEpochsBatch(epochs: CreateEpochData[]): Promise<ApiResponse<Epoch[]>> {
    const response = await visionApi.post('/epochs/batch', { epochs });
    return response.data;
  },

  // Update epoch
  async updateEpoch(id: string, epochData: Partial<CreateEpochData>): Promise<ApiResponse<Epoch>> {
    const response = await visionApi.put(`/epochs/${id}`, epochData);
    return response.data;
  },

  // Delete epoch
  async deleteEpoch(id: string): Promise<ApiResponse<void>> {
    const response = await visionApi.delete(`/epochs/${id}`);
    return response.data;
  }
};
