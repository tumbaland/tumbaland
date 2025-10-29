// Training Types
export interface Training {
  _id: string;
  uuid: string;
  training_uuid?: string; // Alternative UUID field name
  name: string;
  description?: string;
  datasetId?: string;
  configId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  tags?: string[];
  startTime?: string;
  endTime?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  metrics?: {
    totalTime: number;
    epochCount: number;
    cpuCost: number;
    gpuCost: number;
    totalCost: number;
  };
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

// Config Types
export interface Config {
  _id: string;
  config_uuid: string;
  summary: string;
  config_data: Record<string, any>;
  config_name?: string;
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
  configId?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  tags?: string[];
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

export interface CreateConfigData {
  trainingId?: string;
  summary: string;
  config_data: Record<string, any>;
  config_name?: string;
  metadata?: Record<string, any>;
}

// Comment Types
export interface Comment {
  _id: string;
  name: string;
  comment: string;
  trainingId: string;
  section?: string; // e.g., 'iou_chart', 'loss_chart', 'precision_chart', etc.
  parentId?: string;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentData {
  name: string;
  comment: string;
  trainingId: string;
  section?: string;
  parentId?: string;
}

export interface UpdateCommentData {
  name?: string;
  comment?: string;
}
