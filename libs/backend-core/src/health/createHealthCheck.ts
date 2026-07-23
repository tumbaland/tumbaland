import { Request, Response } from 'express';
import mongoose from 'mongoose';

export interface HealthCheckConfig {
  /** Service name reported in the body, e.g. `auth-service`. */
  service: string;
  /** Human-readable service description. */
  description: string;
  /** Reported version. Defaults to `1.0.0`. */
  version?: string;
}

/**
 * Builds a DB-aware readiness handler: reports healthy only while the MongoDB
 * connection is up (`readyState === 1`). It mirrors, byte for byte, the
 * response contract that auth/group/payment each hand-rolled inline —
 * `{ status, service, type, timestamp, version, description,
 * dependencies.mongodb }` on success, and a generic error body on failure —
 * so services can drop the duplicated controller without changing what
 * monitoring sees.
 */
export const createHealthCheck = ({ service, description, version = '1.0.0' }: HealthCheckConfig) => {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const isMongoHealthy = mongoose.connection.readyState === 1; // 1 = connected

      res.status(isMongoHealthy ? 200 : 503).json({
        status: isMongoHealthy ? 'ok' : 'error',
        service,
        type: 'backend',
        timestamp: new Date().toISOString(),
        version,
        description,
        dependencies: {
          mongodb: isMongoHealthy ? 'connected' : 'disconnected'
        }
      });
    } catch {
      res.status(503).json({
        status: 'error',
        service,
        type: 'backend',
        timestamp: new Date().toISOString(),
        version,
        description,
        error: 'Health check failed'
      });
    }
  };
};
