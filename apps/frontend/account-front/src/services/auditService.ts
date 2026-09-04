import { accountApi } from './accountApi';

/**
 * The audit trail.
 *
 * Served by auth-service alongside API keys and connected apps, because it
 * answers the other half of the same question — those say what *can* reach the
 * data, this says what actually did. The rows themselves span every service, so
 * there is no domain service it would belong to more than the others.
 */

export type ActorKind = 'person' | 'key' | 'assistant';
export type AuditAction = 'create' | 'update' | 'delete' | 'read';

export interface AuditEntry {
  id: string;
  at: string;
  service: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  actorKind: ActorKind;
  actorLabel: string;
  actorCredentialId?: string;
  tenant: string;
  /** present on updates: what moved, field by field */
  changes?: Record<string, { from: unknown; to: unknown }>;
  /** present on creates and deletes: the document as it was */
  snapshot?: Record<string, unknown>;
  /** present on reads: how many records left the server */
  count?: number;
}

export interface AuditPage {
  events: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuditFilters {
  actorKind?: ActorKind;
  action?: AuditAction;
  /** narrow to one area — 'relationship-service', 'album-service', 'finance-service' */
  service?: string;
  page?: number;
  limit?: number;
}

interface Wrapped<T> {
  success: boolean;
  data: T;
}

export const auditService = {
  async list(filters: AuditFilters = {}): Promise<AuditPage> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }

    const response = await accountApi.get<Wrapped<AuditPage>>(
      `/auth/audit${query.size > 0 ? `?${query}` : ''}`
    );
    return response.data;
  }
};
