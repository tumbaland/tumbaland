import { Request, Response } from 'express';
import mongoose from 'mongoose';

/**
 * Health check endpoint with database connectivity
 * Returns comprehensive health status for monitoring
 */
export const healthCheck = async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    const mongoState = mongoose.connection.readyState;
    const isMongoHealthy = mongoState === 1; // 1 = connected

    const healthResponse = {
      status: isMongoHealthy ? 'ok' : 'error',
      service: 'payment-service',
      type: 'backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      description: 'Payment processing and subscription management service',
      dependencies: {
        mongodb: isMongoHealthy ? 'connected' : 'disconnected'
      }
    };

    res.status(isMongoHealthy ? 200 : 503).json(healthResponse);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'payment-service',
      type: 'backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      description: 'Payment processing and subscription management service',
      error: 'Health check failed'
    });
  }
};