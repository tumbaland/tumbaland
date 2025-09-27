import { Request, Response } from 'express';

/**
 * Health check endpoint
 * Returns basic health status for monitoring
 */
export const healthCheck = async (req: Request, res: Response) => {
  try {
    const healthResponse = {
      status: 'ok',
      service: 'public-service',
      type: 'backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      description: 'Public API endpoints service'
    };

    res.status(200).json(healthResponse);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'public-service',
      type: 'backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      description: 'Public API endpoints service',
      error: 'Health check failed'
    });
  }
};