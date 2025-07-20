
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
      OBJECT_DETECTION_API_URL: import.meta.env.VITE_OBJECT_DETECTION_API_URL,
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

export interface ObjectDetectionResponse {
  success: boolean;
  file_id: string;
  result_id: string;
  original_filename: string;
  detections: Detection[];
  total_detections: number;
  image_dimensions: {
    width: number;
    height: number;
  };
  confidence_threshold: number;
  model_name: string;
  processing_time: number;
  visualization_path?: string;
}

export interface Detection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: BoundingBox;
  center_point: number[]; // [x, y]
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

export interface ObjectDetectionResult {
  _id: string;
  file_id: string;
  original_filename: string;
  file_path: string;
  visualization_path?: string;
  detections: Detection[];
  total_detections: number;
  image_dimensions: {
    width: number;
    height: number;
  };
  confidence_threshold: number;
  target_classes?: string[];
  model_name: string;
  processing_time: number;
  created_at: string;
}

export interface HealthStatus {
  segmentation: boolean;
  objectDetection: boolean;
  lastChecked: Date;
}

export interface SegmentationOptions {
  promptPoints?: number[][];
  promptLabels?: number[];
  confidenceThreshold?: number;
  modelName?: string;
}

export interface ObjectDetectionOptions {
  confidenceThreshold?: number;
  targetClasses?: string[];
  createVisualization?: boolean;
  showOnlyTop?: boolean;
  modelName?: string;
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public service: 'segmentation' | 'object-detection',
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

// Helper function to create FormData for file upload
const createFormDataWithFile = (
  blob: Blob, 
  filename: string, 
  additionalFields: Record<string, any> = {}
): FormData => {
  const formData = new FormData();
  formData.append('file', blob, filename);
  
  // Add additional fields
  Object.entries(additionalFields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  });
  
  return formData;
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

export const aiService = {
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

  async checkObjectDetectionHealth(): Promise<boolean> {
    try {
      const config = getConfig();
      const apiUrl = config.OBJECT_DETECTION_API_URL;
      // Try the proper health endpoint first, fallback to statistics if not available
      const response = await fetchWithTimeout(`${apiUrl}/api/v1/object-detection/health`, {
        timeout: HEALTH_CHECK_TIMEOUT
      });
      
      if (response.ok) {
        return true;
      }
      
      // Fallback to statistics endpoint for older versions
      const statsResponse = await fetchWithTimeout(`${apiUrl}/api/v1/object-detection/statistics`, {
        timeout: HEALTH_CHECK_TIMEOUT
      });
      return statsResponse.ok;
    } catch (error) {
      console.warn('Object detection service health check failed:', error);
      return false;
    }
  },

  async checkAllServicesHealth(): Promise<HealthStatus> {
    const [segmentation, objectDetection] = await Promise.allSettled([
      this.checkSegmentationHealth(),
      this.checkObjectDetectionHealth()
    ]);

    return {
      segmentation: segmentation.status === 'fulfilled' ? segmentation.value : false,
      objectDetection: objectDetection.status === 'fulfilled' ? objectDetection.value : false,
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

  // Object detection functions
  async detectObjects(
    photoId: string, 
    options: ObjectDetectionOptions = {}
  ): Promise<ObjectDetectionResponse> {
    try {
      // Check if service is healthy first
      const isHealthy = await this.checkObjectDetectionHealth();
      if (!isHealthy) {
        throw new AIServiceError('Object detection service is not available', 'object-detection');
      }

      // Fetch the photo file
      const photoResponse = await photoService.getPhotoById(photoId);
      if (!photoResponse.success || !photoResponse.data) {
        throw new AIServiceError('Photo not found', 'object-detection');
      }

      const photo = photoResponse.data;
      const fileBlob = await fetchPhotoFile(photoId);

      // Prepare form data
      const formData = createFormDataWithFile(fileBlob, photo.originalName, {
        confidence_threshold: options.confidenceThreshold ?? 0.25,
        target_classes: options.targetClasses?.join(','),
        create_visualization: options.createVisualization ?? true,
        show_only_top: options.showOnlyTop ?? false,
        model_name: options.modelName
      });

      const response = await fetchWithTimeout(
        `${getConfig().OBJECT_DETECTION_API_URL}/api/v1/object-detection/detect`,
        {
          method: 'POST',
          body: formData,
          timeout: 60000 // 60 second timeout for processing
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ObjectDetectionResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error in detectObjects:', error);
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Object detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'object-detection',
        getErrorStatus(error)
      );
    }
  },

  async getObjectDetectionResult(resultId: string): Promise<ObjectDetectionResult> {
    try {
      const response = await fetchWithTimeout(
        `${getConfig().OBJECT_DETECTION_API_URL}/api/v1/object-detection/results/${resultId}`,
        { timeout: 10000 }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting object detection result:', error);
      throw new AIServiceError(
        `Failed to get object detection result: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'object-detection',
        getErrorStatus(error)
      );
    }
  },

  async getObjectDetectionResultsByFileId(fileId: string): Promise<{ results: ObjectDetectionResult[]; count: number }> {
    try {
      const response = await fetchWithTimeout(
        `${getConfig().OBJECT_DETECTION_API_URL}/api/v1/object-detection/results/file/${fileId}`,
        { timeout: 10000 }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting object detection results by file ID:', error);
      throw new AIServiceError(
        `Failed to get object detection results: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'object-detection',
        getErrorStatus(error)
      );
    }
  },

  // Utility functions
  async getAvailableClasses(): Promise<string[]> {
    try {
      const response = await fetchWithTimeout(
        `${getConfig().OBJECT_DETECTION_API_URL}/api/v1/object-detection/available-classes`,
        { timeout: 10000 }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.all_classes;
    } catch (error) {
      console.error('Error getting available classes:', error);
      throw new AIServiceError(
        `Failed to get available classes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'object-detection',
        getErrorStatus(error)
      );
    }
  },

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetchWithTimeout(
        `${getConfig().OBJECT_DETECTION_API_URL}/api/v1/object-detection/available-models`,
        { timeout: 10000 }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.models;
    } catch (error) {
      console.error('Error getting available models:', error);
      throw new AIServiceError(
        `Failed to get available models: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'object-detection',
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
  },

  getObjectDetectionVisualizationUrl(resultId: string): string {
    const config = getConfig();
    return `${config.OBJECT_DETECTION_API_URL}/api/v1/object-detection/files/result/${resultId}/visualization`;
  },

  getObjectDetectionOriginalUrl(resultId: string): string {
    const config = getConfig();
    return `${config.OBJECT_DETECTION_API_URL}/api/v1/object-detection/files/result/${resultId}/original`;
  },

  // Helper function to get full URL for visualization path
  getVisualizationImageUrl(visualizationPath: string): string {
    const config = getConfig();
    return `${config.OBJECT_DETECTION_API_URL}/api/v1/object-detection/files/${visualizationPath}`;
  }
};
