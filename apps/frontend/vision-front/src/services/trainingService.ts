import { visionApi } from '../config/visionApi';
import {
  Training,
  CreateTrainingData,
  TrainingWithEpochs,
  ApiResponse,
  PaginatedResponse
} from '../types';

export const trainingService = {
  // Get all trainings
  async getTrainings(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed';
    datasetId?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Training>> {
    const response = await visionApi.get('/trainings', { params });
    return response.data;
  },

  // Get training by ID
  async getTrainingById(id: string): Promise<ApiResponse<Training>> {
    const response = await visionApi.get(`/trainings/${id}`);
    return response.data;
  },

  // Get training by UUID
  async getTrainingByUuid(uuid: string): Promise<ApiResponse<Training>> {
    const response = await visionApi.get(`/trainings/uuid/${uuid}`);
    return response.data;
  },

  // Get training with all epochs
  async getTrainingWithEpochs(id: string, params?: {
    sortBy?: string;
    order?: 'asc' | 'desc';
  }): Promise<ApiResponse<TrainingWithEpochs>> {
    const response = await visionApi.get(`/trainings/${id}/epochs`, { params });
    return response.data;
  },

  // Create training
  async createTraining(trainingData: CreateTrainingData): Promise<ApiResponse<Training>> {
    const response = await visionApi.post('/trainings', trainingData);
    return response.data;
  },

  // Update training
  async updateTraining(id: string, trainingData: Partial<CreateTrainingData>): Promise<ApiResponse<Training>> {
    const response = await visionApi.put(`/trainings/${id}`, trainingData);
    return response.data;
  },

  // Delete training
  async deleteTraining(id: string): Promise<ApiResponse<void>> {
    const response = await visionApi.delete(`/trainings/${id}`);
    return response.data;
  }
};
