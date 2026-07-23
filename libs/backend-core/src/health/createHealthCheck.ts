import { Request, Response } from 'express';
import mongoose from 'mongoose';

export interface HealthCheckConfig {
  /** Service name reported in the body, e.g. `auth-service`. */
  service: string;
  /** Human-readable service description. */
  description: string;
  /** Reported version. Defaults to `1.0.0`. */
  version?: string;
  /**
   * Whether readiness depends on the MongoDB connection. Defaults to `true`:
   * the response reports `dependencies.mongodb` and returns 503 while
   * disconnected. Set `false` for services with no database (e.g.
   * public-service), which then always report `ok` with no `dependencies`.
   */
  checkDatabase?: boolean;
}

/**
 * The single, unified `/health` readiness handler for every backend service.
 *
 * Response contract (identical across services):
 *   { status, service, type: 'backend', timestamp, version, description }
 * plus, when `checkDatabase` is `true` (the default), a
 * `dependencies.mongodb` field and a 503 while the connection is down. A
 * DB-less service (`checkDatabase: false`) omits `dependencies` and always
 * reports `ok`. On an unexpected failure the handler returns 503 with a
 * generic `error: 'Health check failed'` body.
 *
 * `/health/live` (liveness, no dependency checks) is mounted separately by
 * `createBaseApp`.
 */
export const createHealthCheck = ({
  service,
  description,
  version = '1.0.0',
  checkDatabase = true
}: HealthCheckConfig) => {
  return async (_req: Request, res: Response): Promise<void> => {
    const timestamp = new Date().toISOString();
    const base = { service, type: 'backend', timestamp, version, description };

    if (!checkDatabase) {
      res.status(200).json({ status: 'ok', ...base });
      return;
    }

    try {
      const isMongoHealthy = mongoose.connection.readyState === 1; // 1 = connected

      res.status(isMongoHealthy ? 200 : 503).json({
        status: isMongoHealthy ? 'ok' : 'error',
        ...base,
        dependencies: {
          mongodb: isMongoHealthy ? 'connected' : 'disconnected'
        }
      });
    } catch {
      res.status(503).json({
        status: 'error',
        ...base,
        error: 'Health check failed'
      });
    }
  };
};
