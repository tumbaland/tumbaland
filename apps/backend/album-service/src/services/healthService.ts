import mongoose from 'mongoose';

class HealthService {
  /**
   * Check service health and dependencies
   */
  async checkHealth(): Promise<{
    status: 'ok' | 'error';
    service: string;
    type: string;
    timestamp: string;
    version: string;
    description: string;
    dependencies: Record<string, string>;
  }> {
    // Check MongoDB connection
    const mongoState = mongoose.connection.readyState;
    const isMongoHealthy = mongoState === 1; // 1 = connected

    return {
      status: isMongoHealthy ? 'ok' : 'error',
      service: 'album-service',
      type: 'backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      description: 'Photo album management service',
      dependencies: {
        mongodb: isMongoHealthy ? 'connected' : 'disconnected'
      }
    };
  }

  /**
   * Get HTTP status code based on health
   */
  getHealthStatusCode(health: any): number {
    return health.status === 'ok' ? 200 : 503;
  }
}

export default new HealthService();
