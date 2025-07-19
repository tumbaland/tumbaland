
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
  file_id: string;
  result_id: string;
  original_filename: string;
  masks: MaskData[];
  total_masks: number;
  image_dimensions: {
    width: number;
    height: number;
  };
  result_paths: {
    masks: string;
    colored_masks: string;
    segmented: string;
  };
  segmentation_type: 'prompted' | 'automatic';
  processing_time: number;
}

export interface MaskData {
  mask_file_path: string;
  area: number;
  bbox: number[]; // [x, y, width, height]
  predicted_iou: number;
  stability_score: number;
}

export interface SegmentationResult {
  _id: string;
  file_id: string;
  original_filename: string;
  file_path: string;
  result_paths: {
    masks: string;
    colored_masks: string;
    segmented: string;
  };
  masks: MaskData[];
  total_masks: number;
  image_dimensions: {
    width: number;
    height: number;
  };
  prompt_points?: number[][];
  prompt_labels?: number[];
  multimask_output: boolean;
  segmentation_type: 'prompted' | 'automatic';
  processing_time: number;
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
  multimaskOutput?: boolean;
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
      const response = await fetchWithTimeout(`${apiUrl}/api/v1/segmentation/statistics`, {
        timeout: HEALTH_CHECK_TIMEOUT
      });
      return response.ok;
    } catch (error) {
      console.warn('Segmentation service health check failed:', error);
      return false;
    }
  },

  async checkObjectDetectionHealth(): Promise<boolean> {
    try {
      const config = getConfig();
      const apiUrl = config.OBJECT_DETECTION_API_URL;
      const response = await fetchWithTimeout(`${apiUrl}/api/v1/object-detection/statistics`, {
        timeout: HEALTH_CHECK_TIMEOUT
      });
      return response.ok;
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

      // Prepare form data
      const formData = createFormDataWithFile(fileBlob, photo.originalName, {
        prompt_points: options.promptPoints,
        prompt_labels: options.promptLabels,
        multimask_output: options.multimaskOutput ?? true
      });

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

  async getSegmentationResult(resultId: string): Promise<SegmentationResult> {
    try {
      const response = await fetchWithTimeout(
        `${getConfig().SEGMENTATION_API_URL}/api/v1/segmentation/results/${resultId}`,
        { timeout: 10000 }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting segmentation result:', error);
      throw new AIServiceError(
        `Failed to get segmentation result: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'segmentation',
        getErrorStatus(error)
      );
    }
  },

  async getSegmentationResultsByFileId(fileId: string): Promise<{ results: SegmentationResult[]; count: number }> {
    try {
      const response = await fetchWithTimeout(
        `${getConfig().SEGMENTATION_API_URL}/api/v1/segmentation/results/file/${fileId}`,
        { timeout: 10000 }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting segmentation results by file ID:', error);
      throw new AIServiceError(
        `Failed to get segmentation results: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  // File serving functions
  getSegmentationFileUrl(resultId: string, fileType: 'segmented' | 'masks' | 'colored_masks'): string {
    const config = getConfig();
    return `${config.SEGMENTATION_API_URL}/api/v1/segmentation/files/result/${resultId}/${fileType}`;
  },

  getMaskFileUrl(resultId: string, maskIndex: number): string {
    const config = getConfig();
    return `${config.SEGMENTATION_API_URL}/api/v1/segmentation/files/mask/${resultId}/${maskIndex}`;
  },

  // Helper function to get full URL for segmentation file paths
  getSegmentationImageUrl(filePath: string): string {
    const config = getConfig();
    return `${config.SEGMENTATION_API_URL}/api/v1/segmentation/files/${filePath}`;
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
