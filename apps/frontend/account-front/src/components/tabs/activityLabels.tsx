import React from 'react';
import { Add, Edit, DeleteOutlined, Visibility, Person, VpnKey, SmartToy, Bolt } from '@mui/icons-material';
import type { ActorKind, AuditAction } from '../../services/auditService';

/** What each kind of actor looks like, so a row is scannable before it is read. */
export const ACTORS: Record<ActorKind, { label: string; icon: React.ReactElement; color: 'default' | 'info' | 'warning' }> = {
  person: { label: 'You', icon: <Person fontSize="small" />, color: 'default' },
  assistant: { label: 'Assistant', icon: <SmartToy fontSize="small" />, color: 'info' },
  key: { label: 'API key', icon: <VpnKey fontSize="small" />, color: 'warning' }
};

/**
 * The trail spans every service, so it needs a way to narrow to one.
 *
 * Named for what they are to a person rather than for the process that wrote
 * them: nobody thinks of their photos as "album-service".
 */
export const AREAS = [
  { value: 'all', label: 'All' },
  { value: 'relationship-service', label: 'Journal' },
  { value: 'album-service', label: 'Photos' },
  { value: 'finance-service', label: 'Money' },
  { value: 'auth-service', label: 'Account' },
  { value: 'mcp-service', label: 'Assistant' }
] as const;

export const ACTIONS: Record<AuditAction, { verb: string; icon: React.ReactElement; color: string }> = {
  create: { verb: 'added', icon: <Add fontSize="small" />, color: 'success.main' },
  update: { verb: 'changed', icon: <Edit fontSize="small" />, color: 'warning.main' },
  delete: { verb: 'removed', icon: <DeleteOutlined fontSize="small" />, color: 'error.main' },
  read: { verb: 'read', icon: <Visibility fontSize="small" />, color: 'text.secondary' },
  call: { verb: 'called', icon: <Bolt fontSize="small" />, color: 'info.main' }
};
