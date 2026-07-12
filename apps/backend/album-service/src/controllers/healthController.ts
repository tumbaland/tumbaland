import { Request, Response } from 'express';
import { logger } from '@tumbaland/backend-core';
import healthService from '../services/healthService';

/**
 * Health check endpoint with database connectivity
 */
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const health = await healthService.checkHealth();
    const statusCode = healthService.getHealthStatusCode(health);
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error', { error: (error as Error)?.message });
    res.status(503).json({
      status: 'error',
      service: 'album-service',
      type: 'backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      description: 'Photo album management service',
      error: 'Health check failed'
    });
  }
};