import mongoose from 'mongoose';

interface HealthStatus {
  status: 'ok' | 'error';
  service: string;
  type: string;
  timestamp: string;
  version: string;
  description: string;
  dependencies?: Record<string, string>;
  error?: string;
}

/**
 * Check service health and dependencies
 */
export async function checkHealth(): Promise<HealthStatus> {
  const mongoState = mongoose.connection.readyState;
  const isMongoHealthy = mongoState === 1; // 1 = connected

  return {
    status: isMongoHealthy ? 'ok' : 'error',
    service: 'finance-service',
    type: 'backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    description: 'Financial tracking and portfolio management service',
    dependencies: {
      mongodb: isMongoHealthy ? 'connected' : 'disconnected'
    }
  };
}

/**
 * Get HTTP status code for health status
 */
export function getHealthStatusCode(health: HealthStatus): number {
  return health.status === 'ok' ? 200 : 503;
}
