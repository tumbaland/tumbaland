import { getGlobalConfig } from '../config/ConfigProvider';

export interface ClassAnalysis {
  name: string;
  class_id: number;
  total_pixels: number;
  pixel_percentage: number;
  frames_with_class: number;
  frame_coverage_percentage: number;
  avg_pixels_per_frame: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface DatasetAnalysis {
  _id: string;
  timestamp: string;
  dataset: string;
  total_frames: number;
  total_pixels: number;
  total_classes: number;
  image_dimensions: ImageDimensions;
  class_analysis: ClassAnalysis[];
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisResponse {
  data: DatasetAnalysis[];
  pagination?: {
    total: number;
    limit: number;
    skip: number;
  };
}

/**
 * Upload analysis JSON data
 */
export const uploadAnalysis = async (analysisData: any): Promise<DatasetAnalysis> => {
  const config = getGlobalConfig();
  const apiUrl = config.VISION_API_URL || 'https://vision-api.tumbaland.eu';
  
  const response = await fetch(`${apiUrl}/api/analysis/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(analysisData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload analysis');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Get all analyses
 */
export const getAllAnalyses = async (
  limit: number = 50,
  skip: number = 0,
  dataset?: string
): Promise<AnalysisResponse> => {
  const config = getGlobalConfig();
  const apiUrl = config.VISION_API_URL || 'https://vision-api.tumbaland.eu';
  
  const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
  if (dataset) {
    params.append('dataset', dataset);
  }

  const response = await fetch(`${apiUrl}/api/analysis?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch analyses');
  }

  return response.json();
};

/**
 * Get analyses by dataset name
 */
export const getAnalysesByDataset = async (
  datasetName: string,
  limit: number = 50,
  skip: number = 0
): Promise<AnalysisResponse> => {
  const config = getGlobalConfig();
  const apiUrl = config.VISION_API_URL || 'https://vision-api.tumbaland.eu';
  
  const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });

  const response = await fetch(`${apiUrl}/api/analysis/dataset/${datasetName}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch analyses');
  }

  return response.json();
};

/**
 * Get analysis by ID
 */
export const getAnalysisById = async (id: string): Promise<DatasetAnalysis> => {
  const config = getGlobalConfig();
  const apiUrl = config.VISION_API_URL || 'https://vision-api.tumbaland.eu';
  
  const response = await fetch(`${apiUrl}/api/analysis/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch analysis');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Delete analysis by ID
 */
export const deleteAnalysis = async (id: string): Promise<void> => {
  const config = getGlobalConfig();
  const apiUrl = config.VISION_API_URL || 'https://vision-api.tumbaland.eu';
  
  const response = await fetch(`${apiUrl}/api/analysis/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete analysis');
  }
};
