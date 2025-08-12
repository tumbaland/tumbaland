import { getGlobalConfig } from '../config/ConfigProvider';
import type { Group, GroupMember } from '../types';

export type GroupRole = GroupMember['role'];

async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const { GROUP_API_URL } = getGlobalConfig();
  const token = localStorage.getItem('authToken');

  const mergedHeaders: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const res = await fetch(`${GROUP_API_URL}${path}`, {
    ...init,
    headers: mergedHeaders
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j?.message) message = j.message; } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

function json(method: string, body?: any): RequestInit {
  return {
    method,
  headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  };
}

function get(path: string) { return api(path); }
function post(path: string, body?: any) { return api(path, json('POST', body)); }
function patch(path: string, body?: any) { return api(path, json('PATCH', body)); }
function del(path: string) { return api(path, { method: 'DELETE' }); }

export const groupApi = {
  async listMyGroups(): Promise<Group[]> {
    const j = await get('/api/groups/mine');
    return j?.data ?? [];
  },
  async createGroup(name: string): Promise<Group> {
    const j = await post('/api/groups', { name });
    return j.data as Group;
  },
  async getGroup(id: string): Promise<Group> {
    const j = await get(`/api/groups/${encodeURIComponent(id)}`);
    return j.data as Group;
  },
  async inviteMember(id: string, inviteEmail: string, role: GroupRole = 'member'): Promise<{ token: string; expiresAt?: string }> {
    const j = await post(`/api/groups/${encodeURIComponent(id)}/invite`, { inviteEmail, role });
    return j.data as { token: string; expiresAt?: string };
  },
  async acceptInvite(id: string, token: string): Promise<boolean> {
    await post(`/api/groups/${encodeURIComponent(id)}/accept`, { token });
    return true;
  },
  async updateMemberRole(id: string, memberEmail: string, role: GroupRole): Promise<Group> {
    const j = await patch(`/api/groups/${encodeURIComponent(id)}/members/${encodeURIComponent(memberEmail)}`, { role });
    return j.data as Group;
  },
  async removeMember(id: string, memberEmail: string): Promise<Group> {
    const j = await del(`/api/groups/${encodeURIComponent(id)}/members/${encodeURIComponent(memberEmail)}`);
    return j.data as Group;
  }
};
