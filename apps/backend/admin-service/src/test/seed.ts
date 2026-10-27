import { Types } from 'mongoose';
import { AuditEvent, UserDay } from '@tumbaland/backend-core';
import { AdminUser } from '../models/readModels';

/** The clock the tests run at: a Tuesday, in a week that started on Monday 2026-10-26. */
export const NOW = new Date('2026-10-27T12:00:00.000Z');

export const at = (iso: string): Date => new Date(iso);

export interface SeededUser {
  id: string;
  email: string;
}

export async function user(
  email: string,
  fields: Record<string, unknown> = {}
): Promise<SeededUser> {
  const created = await AdminUser.create({
    email,
    roles: [],
    createdAt: at('2026-09-01T10:00:00Z'),
    ...fields
  });
  return { id: String(created._id), email };
}

export async function activeDay(
  userId: string,
  day: string,
  fields: Record<string, unknown> = {}
): Promise<void> {
  await UserDay.create({
    userId,
    day,
    visits: 1,
    firstAt: at(`${day}T08:00:00Z`),
    lastAt: at(`${day}T09:00:00Z`),
    ...fields
  });
}

interface CallFields {
  userId: string;
  at: string;
  tool?: string;
  tokens?: number;
  ms?: number;
  failed?: boolean;
  actorKind?: 'assistant' | 'key' | 'person';
  credentialId?: string;
  label?: string;
}

/** One MCP tool call, as mcp-service records it. */
export async function toolCall(fields: CallFields): Promise<void> {
  await AuditEvent.create({
    at: at(fields.at),
    service: 'mcp-service',
    action: 'call',
    resource: 'tool',
    actorKind: fields.actorKind ?? 'assistant',
    userId: fields.userId,
    actorLabel: fields.label ?? 'Claude',
    actorCredentialId: fields.credentialId ?? 'client-claude',
    tenant: 'personal',
    tool: {
      name: fields.tool ?? 'get_day',
      ms: fields.ms ?? 100,
      chars: (fields.tokens ?? 100) * 4,
      tokens: fields.tokens ?? 100,
      ...(fields.failed ? { failed: true } : {})
    }
  });
}

interface WriteFields {
  userId: string;
  at: string;
  service?: string;
  resource?: string;
  action?: 'create' | 'update' | 'delete' | 'read';
  actorKind?: 'assistant' | 'key' | 'person';
  /** Content that must never leave the service. */
  changes?: Record<string, { from: unknown; to: unknown }>;
  snapshot?: Record<string, unknown>;
}

export async function write(fields: WriteFields): Promise<void> {
  await AuditEvent.create({
    at: at(fields.at),
    service: fields.service ?? 'album-service',
    action: fields.action ?? 'create',
    resource: fields.resource ?? 'photo',
    actorKind: fields.actorKind ?? 'person',
    userId: fields.userId,
    actorLabel: 'Ada',
    tenant: 'personal',
    changes: fields.changes,
    snapshot: fields.snapshot
  });
}

export const objectId = (): string => String(new Types.ObjectId());

/**
 * Every key anywhere in a JSON value, for asserting that something never
 * appears in a response, however deeply it is nested.
 */
export function keysOf(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, found));
  else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      found.add(key);
      keysOf(inner, found);
    }
  }
  return found;
}

/** Fields that hold content or secrets, and that no admin response may carry. */
export const FORBIDDEN_FIELDS = [
  'changes',
  'snapshot',
  'hash',
  'keyId',
  'sealedCiphertext',
  'sealedIv',
  'sealedTag',
  'tokenHash',
  'userAgent',
  'description',
  'text'
];
