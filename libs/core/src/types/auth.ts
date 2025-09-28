export interface UserPayload {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
  correlationId?: string;
}

export interface ServiceHealth {
  status: 'ok' | 'error';
  service: string;
  type: 'backend' | 'frontend';
  timestamp: string;
  version: string;
  description: string;
  dependencies?: Record<string, any>;
}