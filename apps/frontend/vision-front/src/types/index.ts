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
  system_info?: SystemInfo;
  [key: string]: any;
}

// System Info Types
export interface SystemInfo {
  // CPU metrics
  cpu_percent?: number;
  cpu_count?: number;
  cpu_count_physical?: number;

  // Memory metrics
  memory_percent?: number;
  memory_used_gb?: number;
  memory_max_gb?: number;

  // Process info
  process?: {
    cpu_percent?: number;
    memory_gb?: number;
    threads?: number;
  };

  // GPU info (nested under gpu.gpu_0)
  gpu?: {
    gpu_0?: {
      memory_used_gb?: number;
      memory_max_gb?: number;
      memory_reserved_gb?: number;
      memory_utilization_percent?: number;
      gpu_utilization_percent?: number;
      memory_bandwidth_percent?: number;
      temperature_celsius?: number;
      power_watts?: number;
      power_limit_watts?: number;
      power_percent?: number;
      clock_sm_mhz?: number;
      clock_memory_mhz?: number;
      fan_speed_percent?: number;
    };
  };

  // Legacy hardware specs (strings)
  cpu?: string;
  memory?: string;
  os?: string;
  python_version?: string;
  cuda_version?: string;

  // Legacy metrics structure (for future use)
  cpu_metrics?: {
    percent: number;
    count: number;
    physical_count: number;
  };
  memory_metrics?: {
    percent: number;
    used: number;
    total: number;
  };
  gpu_metrics?: {
    utilization: number;
    memory: {
      used: number;
      total: number;
      reserved: number;
    };
    temperature: number;
    power: {
      current: number;
      limit: number;
    };
    clocks: {
      graphics_mhz: number;
      memory_mhz: number;
      video_mhz: number;
    };
    fan_speed_percent: number;
  };
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

// Test Result Types
export interface TestResultMetrics {
  iou: number;
  precision: number;
  recall: number;
  f1_score: number;
  average_precision: number;
}

export interface InferenceTimeMetrics {
  total_seconds: number;
  samples: number;
  batches: number;
  avg_per_sample_ms: number;
  avg_per_batch_ms: number;
  throughput_fps: number;
}

export interface TestResultCondition {
  pedestrian: TestResultMetrics;
  sign: TestResultMetrics;
  cyclist: TestResultMetrics;
  vehicle: TestResultMetrics;
  human: TestResultMetrics;
  inference_time: InferenceTimeMetrics;
  [className: string]: TestResultMetrics | InferenceTimeMetrics;
}

export interface TestResultData {
  day_fair: TestResultCondition;
  night_fair: TestResultCondition;
  day_rain: TestResultCondition;
  night_rain: TestResultCondition;
  snow: TestResultCondition;
  [condition: string]: TestResultCondition;
}

export interface TestResult {
  _id: string;
  timestamp: string;
  epoch: number;
  epoch_uuid: string;
  test_uuid: string;
  test_results: TestResultData;
  createdAt: string;
  updatedAt: string;
  training?: {
    _id: string;
    name: string;
    uuid: string;
    status: string;
  };
  epoch_info?: {
    epoch: number;
    epoch_time: number;
  };
}

export interface CreateTestResultData {
  timestamp?: string;
  epoch: number;
  epoch_uuid: string;
  test_uuid?: string;
  test_results: TestResultData;
}

// Benchmark Types
export interface BenchmarkResult {
  model_name?: string;
  parameters?: number;
  flops?: number;
  fps?: number;
  memory_usage?: number;
  input_size?: string;
  precision?: string;
  framework?: string;
  device?: string;
  batch_size?: number;
  warmup_iterations?: number;
  benchmark_iterations?: number;
  metadata?: Record<string, any>;
}

export interface Benchmark {
  _id: string;
  training_uuid?: string;
  timestamp: string;
  system_info: SystemInfo;
  results: BenchmarkResult[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface BenchmarkStats {
  totalBenchmarks: number;
  totalResults: number;
  avgParameters: number;
  avgFlops: number;
  avgFps: number;
  avgMemoryUsage: number;
}

export interface CreateBenchmarkData {
  training_uuid?: string;
  timestamp?: string;
  system_info: SystemInfo;
  results: BenchmarkResult[];
}

// Visualization Types
export interface Visualization {
  _id: string;
  epoch_uuid: string;
  visualization_uuid: string;
  filename: string;
  type: string;
  minioFileId: string;
  uploadedAt: string;
  metadata?: Record<string, any>;
  signedUrl?: string;
  urlExpiresAt?: string;
  epoch?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisualizationData {
  epoch_uuid: string;
  visualization_uuid: string;
  filename: string;
  type: string;
  minioFileId: string;
  mimetype: string;
  size: number;
  metadata?: Record<string, any>;
}

export interface VisualizationUploadUrlRequest {
  epoch_uuid: string;
  filename: string;
  type: string;
  mimetype: string;
}

export interface VisualizationUploadUrlResponse {
  uploadUrl: string;
  visualization_uuid: string;
  minioFileId: string;
  epoch_uuid: string;
  expiresInMinutes: number;
}
