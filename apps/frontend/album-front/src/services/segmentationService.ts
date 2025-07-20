
import { photoService } from './photoService';
import { getGlobalConfig, AppConfig } from '../config/ConfigProvider';

// Get configuration with fallbacks
function getConfig(): AppConfig {
  try {
    return getGlobalConfig();
  } catch {
    // Fallback to environment variables if config not ready
    return {
      SEGMENTATION_API_URL: import.meta.env.VITE_SEGMENTATION_API_URL,
      FILE_API_URL: import.meta.env.VITE_FILE_API_URL
    };
  }
}

// Health check timeout (3 seconds)
const HEALTH_CHECK_TIMEOUT = 3000;

// Type definitions for API responses
export interface SegmentationResponse {
  success: boolean;
  message: string;
  job_id: string; // Added job_id field from new API
  file_id: string;
  result_id?: string;
  original_filename: string;
  file_path: string;
  masks: MaskData[];
  total_masks: number;
  processing_time?: number;
  image_dimensions: {
    width: number;
    height: number;
  };
  result_paths: {
    masks: string;
    colored_masks: string;
    segmented: string;
  };
  segmentation_type: 'automatic' | 'prompted' | 'error';
  created_at: string;
}

export interface MaskData {
  mask_file_path: string;
  filename: string;
  area: number;
  bbox: number[]; // [x, y, width, height]
  predicted_iou: number;
  stability_score?: number; // Optional, SAM models only
  file_size_bytes: number;
  created_at: string;
  download_url: string;
}

export interface SegmentationJobResult {
  success: boolean;
  message: string;
  job_id: string;
  file_id: string;
  result_id?: string;
  original_filename: string;
  file_path: string;
  result_paths: {
    segmented: string;
    masks: string;
    colored_masks: string;
  };
  has_masks: boolean;
  has_visualization: boolean;
  total_masks: number;
  mask_count: number;
  processing_time: number;
  image_dimensions: {
    width: number;
    height: number;
  };
  segmentation_type: 'automatic' | 'prompted' | 'error';
  model_name: string;
  model_type: string;
  confidence_threshold: number;
  prompt_points?: number[][];
  prompt_labels?: number[];
  masks: MaskData[];
  mask_files: string[];
  visualization_file: string;
  created_at: string;
  file_sizes: {
    visualization_bytes: number;
    total_mask_bytes: number;
    mask_directory_size: number;
  };
  download_urls: {
    visualization: string;
    masks_list: string;
    individual_masks: string[];
  };
}

export interface SegmentationResult {
  success: boolean;
  message: string;
  job_id: string; // Added job_id field from new API
  file_id: string;
  result_id?: string;
  original_filename: string;
  file_path: string;
  result_paths: {
    masks: string;
    colored_masks: string;
    segmented: string;
  };
  masks: MaskData[];
  total_masks: number;
  processing_time?: number;
  image_dimensions: {
    width: number;
    height: number;
  };
  prompt_points?: number[][];
  prompt_labels?: number[];
  segmentation_type: 'automatic' | 'prompted' | 'error';
  model_name?: string; // Optional, from enhanced API response
  model_type?: string; // Optional, from enhanced API response
  confidence_threshold?: number; // Optional, from enhanced API response
  created_at: string;
}

export interface HealthStatus {
  segmentation: boolean;
  lastChecked: Date;
}

export interface SegmentationOptions {
  promptPoints?: number[][];
  promptLabels?: number[];
  confidenceThreshold?: number;
  modelName?: string;
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public service: 'segmentation',
    public status?: number
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

// Helper function to fetch file blob from photo ID
const fetchPhotoFile = async (photoId: string): Promise<Blob> => {
  try {
    // Get photo details to get fileId
    const photoResponse = await photoService.getPhotoById(photoId);
    if (!photoResponse.success || !photoResponse.data) {
      throw new Error('Photo not found');
    }

    const photo = photoResponse.data;
    
    // Use the file service URL pattern from backend
    const FILE_API_URL = getConfig().FILE_API_URL;
    const fileUrl = `${FILE_API_URL}/api/serve/${photo.fileId}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(fileUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.blob();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    console.error('Error fetching photo file:', error);
    throw new AIServiceError(
      `Failed to fetch photo file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'segmentation'
    );
  }
};

// Helper function to handle fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit & { timeout?: number } = {}) => {
  const { timeout = 10000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Helper function to get HTTP status from error
const getErrorStatus = (error: unknown): number | undefined => {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return undefined; // Network error
  }
  if (error instanceof Error && error.message.includes('status:')) {
    const match = error.message.match(/status:\s*(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }
  return undefined;
};

export const segmentationService = {
  // Health check functions
  async checkSegmentationHealth(): Promise<boolean> {
    try {
      const config = getConfig();
      const apiUrl = config.SEGMENTATION_API_URL;
      const response = await fetchWithTimeout(`${apiUrl}/api/v1/segmentation/health`, {
        timeout: HEALTH_CHECK_TIMEOUT
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      console.warn('Segmentation service health check failed:', error);
      return false;
    }
  },

  async getSegmentationHealthDetails(): Promise<any> {
    try {
      const config = getConfig();
      const apiUrl = config.SEGMENTATION_API_URL;
      const response = await fetchWithTimeout(`${apiUrl}/api/v1/segmentation/health`, {
        timeout: HEALTH_CHECK_TIMEOUT
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.warn('Segmentation service health check failed:', error);
      throw new AIServiceError(
        `Failed to get health details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'segmentation'
      );
    }
  },

  async checkAllServicesHealth(): Promise<HealthStatus> {
    const [segmentation] = await Promise.allSettled([
      this.checkSegmentationHealth()
    ]);

    return {
      segmentation: segmentation.status === 'fulfilled' ? segmentation.value : false,
      lastChecked: new Date()
    };
  },

  // Segmentation functions
  async segmentImage(
    photoId: string, 
    options: SegmentationOptions = {}
  ): Promise<SegmentationResponse> {
    try {
      // Check if service is healthy first
      const isHealthy = await this.checkSegmentationHealth();
      if (!isHealthy) {
        throw new AIServiceError('Segmentation service is not available', 'segmentation');
      }

      // Fetch the photo file
      const photoResponse = await photoService.getPhotoById(photoId);
      if (!photoResponse.success || !photoResponse.data) {
        throw new AIServiceError('Photo not found', 'segmentation');
      }

      const photo = photoResponse.data;
      const fileBlob = await fetchPhotoFile(photoId);

      // Prepare form data for new API
      const formData = new FormData();
      formData.append('image', fileBlob, photo.originalName);
      
      // Add optional parameters
      if (options.promptPoints && options.promptPoints.length > 0) {
        formData.append('prompt_points', JSON.stringify(options.promptPoints));
      }
      if (options.promptLabels && options.promptLabels.length > 0) {
        formData.append('prompt_labels', JSON.stringify(options.promptLabels));
      }
      if (options.confidenceThreshold !== undefined) {
        formData.append('confidence_threshold', options.confidenceThreshold.toString());
      }
      if (options.modelName) {
        formData.append('model_name', options.modelName);
      }

      const response = await fetchWithTimeout(
        `${getConfig().SEGMENTATION_API_URL}/api/v1/segmentation/segment`,
        {
          method: 'POST',
          body: formData,
          timeout: 60000 // 60 second timeout for processing
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SegmentationResponse = await response.json();
      
      // Check if the response indicates success
      if (!data.success) {
        throw new AIServiceError(
          data.message || 'Segmentation failed',
          'segmentation'
        );
      }
      
      return data;
    } catch (error) {
      console.error('Error in segmentImage:', error);
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'segmentation',
        getErrorStatus(error)
      );
    }
  },

  // Model management functions
  async getAvailableSegmentationModels(): Promise<string[]> {
    try {
      const response = await fetchWithTimeout(
        `${getConfig().SEGMENTATION_API_URL}/api/v1/segmentation/models`,
        { timeout: 10000 }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.available_models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error('Error getting available segmentation models:', error);
      throw new AIServiceError(
        `Failed to get available models: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'segmentation',
        getErrorStatus(error)
      );
    }
  },

  async switchSegmentationModel(modelName: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetchWithTimeout(
        `${getConfig().SEGMENTATION_API_URL}/api/v1/segmentation/models/switch/${modelName}`,
        { 
          method: 'POST',
          timeout: 30000 // Model switching can take time
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error switching segmentation model:', error);
      throw new AIServiceError(
        `Failed to switch model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'segmentation',
        getErrorStatus(error)
      );
    }
  },

  // File serving functions - Updated for new segmentation API
  // Helper function to get full URL for segmentation file paths (legacy support)
  getSegmentationImageUrl(filePath: string): string {
    const config = getConfig();
    // Remove leading slash if present to avoid double slashes
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    return `${config.SEGMENTATION_API_URL}/${cleanPath}`;
  },

  // New API endpoints for downloading files
  getSegmentationVisualizationUrl(jobId: string): string {
    const config = getConfig();
    return `${config.SEGMENTATION_API_URL}/api/v1/segmentation/results/${jobId}/visualization`;
  },

  getSegmentationMaskUrl(jobId: string, maskFilename: string): string {
    const config = getConfig();
    return `${config.SEGMENTATION_API_URL}/api/v1/segmentation/results/${jobId}/masks/${maskFilename}`;
  },

  // Get job info by job_id (limited info, just file availability)
  async getSegmentationResult(jobId: string): Promise<SegmentationJobResult> {
    try {
      const config = getConfig();
      const response = await fetchWithTimeout(
        `${config.SEGMENTATION_API_URL}/api/v1/segmentation/results/${jobId}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Segmentation job info:', result);
      
      return result;
    } catch (error) {
      console.error('Error fetching segmentation job info:', error);
      throw new AIServiceError(
        `Failed to fetch segmentation job info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'segmentation',
        getErrorStatus(error)
      );
    }
  },

  // Function to extract mask filename from mask_file_path
  getMaskFilename(maskFilePath: string): string {
    // Extract filename from path like "/results/masks_abc123-def456/mask_000.png"
    return maskFilePath.split('/').pop() || '';
  },

  // Function to extract job_id from file paths
  getJobIdFromPath(filePath: string): string {
    // Extract job_id from paths like "/results/masks_abc123-def456/" or "/results/segmented_abc123-def456.png"
    const match = filePath.match(/[_\/]([a-f0-9-]+)[\/_\.]/);
    return match ? match[1] : '';
  }
};
