import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * Health check endpoint with file system connectivity
 * Returns comprehensive health status for monitoring
 */
export const healthCheck = async (req: Request, res: Response) => {
  try {
    // Check file system access (storage directories)
    const storageDir = path.join(process.cwd(), 'storage');
    const cacheDir = path.join(process.cwd(), 'cache');
    const credentialsDir = path.join(process.cwd(), 'credentials');

    let isStorageHealthy = true;
    const storageChecks = {
      storage: false,
      cache: false,
      credentials: false
    };

    try {
      await fs.promises.access(storageDir, fs.constants.W_OK);
      storageChecks.storage = true;
    } catch {
      isStorageHealthy = false;
    }

    try {
      await fs.promises.access(cacheDir, fs.constants.W_OK);
      storageChecks.cache = true;
    } catch {
      isStorageHealthy = false;
    }

    try {
      await fs.promises.access(credentialsDir, fs.constants.W_OK);
      storageChecks.credentials = true;
    } catch {
      isStorageHealthy = false;
    }

    const healthResponse = {
      status: isStorageHealthy ? 'ok' : 'error',
      service: 'file-service',
      type: 'backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      description: 'File storage and processing service',
      dependencies: {
        filesystem: storageChecks
      }
    };

    res.status(isStorageHealthy ? 200 : 503).json(healthResponse);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'file-service',
      type: 'backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      description: 'File storage and processing service',
      error: 'Health check failed'
    });
  }
};