import mongoose from 'mongoose';

export interface HealthStatus {
  status: 'ok' | 'error';
  service: string;
  type: string;
  timestamp: string;
  version: string;
  description: string;
  dependencies: {
    mongodb: string;
  };
}

/**
 * Check service health including database connectivity
 */
export const checkHealth = (): HealthStatus => {
  try {
    const mongoState = mongoose.connection.readyState;
    const isMongoHealthy = mongoState === 1; // 1 = connected

    return {
      status: isMongoHealthy ? 'ok' : 'error',
      service: 'relationship-service',
      type: 'backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      description: 'Social relationship management service',
      dependencies: {
        mongodb: isMongoHealthy ? 'connected' : 'disconnected'
      }
    };
  } catch (error) {
    return {
      status: 'error',
      service: 'relationship-service',
      type: 'backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      description: 'Social relationship management service',
      dependencies: {
        mongodb: 'unknown'
      }
    };
  }
};

/**
 * Get HTTP status code based on health status
 */
export const getHealthStatusCode = (health: HealthStatus): number => {
  return health.status === 'ok' ? 200 : 503;
};
