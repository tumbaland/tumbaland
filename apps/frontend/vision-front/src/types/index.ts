// Dataset Types
export interface Dataset {
  _id: string;
  uuid: string;
  name: string;
  description?: string;
  timestamp: string;
  dataset_info?: {
    path?: string;
    total_frames?: number;
    frame_list_file?: string;
    [key: string]: any;
  };
  annotations?: {
    total_frames?: number;
    total_pixels?: number;
    class_distribution?: Record<string, {
      class_id?: number;
      pixel_count?: number;
      percentage?: number;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  camera?: {
    total_images?: number;
    mean_rgb?: number[];
    std_rgb?: number[];
    normalized_mean_rgb?: number[];
    normalized_std_rgb?: number[];
    [key: string]: any;
  };
  lidar?: {
    total_files?: number;
    total_points?: number;
    lidar_mean?: number[];
    lidar_std?: number[];
    [key: string]: any;
  };
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Training Types
export interface Training {
  _id: string;
  uuid: string;
  training_uuid?: string; // Alternative UUID field name
  name: string;
  description?: string;
  datasetId?: string;
  configuration: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Epoch Types
export interface EpochMetrics {
  iou?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  [key: string]: any;
}

export interface EpochResults {
  train?: {
    loss?: number;
    mean_iou?: number;
    [className: string]: EpochMetrics | number | undefined;
  };
  val?: {
    loss?: number;
    mean_iou?: number;
    [className: string]: EpochMetrics | number | undefined;
  };
  [key: string]: any;
}

export interface Epoch {
  _id: string;
  trainingId: string;
  training_uuid: string;
  epoch_uuid: string;
  epoch: number;
  timestamp: string;
  results: EpochResults;
  learning_rate?: number;
  epoch_time?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    [key: string]: T[];
  } & {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    total?: number;
  };
}

// Training with Epochs
export interface TrainingWithEpochs {
  training: Training;
  epochs: Epoch[];
}

// Create/Update Types
export interface CreateDatasetData {
  uuid?: string;
  name: string;
  description?: string;
  timestamp?: string;
  dataset_info?: Record<string, any>;
  annotations?: Record<string, any>;
  camera?: Record<string, any>;
  lidar?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CreateTrainingData {
  uuid?: string;
  name: string;
  description?: string;
  datasetId?: string;
  configuration: Record<string, any>;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  metadata?: Record<string, any>;
}

export interface CreateEpochData {
  trainingId: string;
  training_uuid: string;
  epoch_uuid?: string;
  epoch: number;
  timestamp?: string;
  results: EpochResults;
  learning_rate?: number;
  epoch_time?: number;
  metadata?: Record<string, any>;
}
