import type { Span } from '@opentelemetry/api';

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  picture?: string;
  groups?: string[];
  roles?: string[];
  tokenVersion?: number;
  /** The auth-service session (user_sessions) this token belongs to; absent on pre-sessions tokens. */
  sid?: string;
}

/**
 * Attaches `user`/`userGroups` to every Express `Request` across all
 * services, replacing the ad-hoc `(req as any).user` casts and each
 * service's own divergent local augmentation. Individual services may still
 * carry additional request-scoped fields (e.g. auth-service's `dbUser`) —
 * those stay local since they aren't meaningful outside that service.
 *
 * `correlationId` is set by `correlationMiddleware`, `span` by
 * `tracingMiddleware`; both are declared here so the observability middleware
 * and downstream handlers can read them without a `(req as any)` cast.
 */
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      userGroups?: string[];
      correlationId?: string;
      span?: Span;
    }
  }
}

export interface ServiceHealth {
  status: 'ok' | 'error';
  service: string;
  type: 'backend' | 'frontend';
  timestamp: string;
  version: string;
  description: string;
  dependencies?: Record<string, unknown>;
}