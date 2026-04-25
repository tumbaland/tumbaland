import { Request, Response } from 'express';
import { checkHealth, getHealthStatusCode } from '../services/health.service';

/**
 * Health check endpoint
 */
export const healthCheck = (req: Request, res: Response): void => {
  const health = checkHealth();
  const statusCode = getHealthStatusCode(health);
  res.status(statusCode).json(health);
};