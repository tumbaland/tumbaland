import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';
import type { Group, GroupMember } from '../types';

export type GroupRole = GroupMember['role'];

const client = createApiClient({
  baseUrl: () => getGlobalConfig().GROUP_API_URL!,
  onUnauthorized: () => {
    const { AUTH_FRONT_URL } = getGlobalConfig();
    if (AUTH_FRONT_URL) {
      window.location.href = `${AUTH_FRONT_URL}?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
  }
});

export const groupApi = {
  async listMyGroups(): Promise<Group[]> {
    const j = await client.get<{ data: Group[] }>('/api/groups/mine');
    return j?.data ?? [];
  },

  async getMyGroupIds(): Promise<string[]> {
    const j = await client.get<{ data: string[] }>('/api/groups/mine/ids');
    return j?.data ?? [];
  },

  async createGroup(name: string): Promise<Group> {
    const j = await client.post<{ data: Group }>('/api/groups', { name });
    return j.data;
  },

  async getGroup(id: string): Promise<Group> {
    const j = await client.get<{ data: Group }>(`/api/groups/${encodeURIComponent(id)}`);
    return j.data;
  },

  async updateGroup(id: string, updates: { name?: string }): Promise<Group> {
    const j = await client.patch<{ data: Group }>(`/api/groups/${encodeURIComponent(id)}`, updates);
    return j.data;
  },

  async deleteGroup(id: string): Promise<void> {
    await client.delete(`/api/groups/${encodeURIComponent(id)}`);
  },

  async addMember(id: string, email: string, role: GroupRole = 'member'): Promise<Group> {
    const j = await client.post<{ data: Group }>(`/api/groups/${encodeURIComponent(id)}/members`, { email, role });
    return j.data;
  },

  async updateMemberRole(id: string, memberEmail: string, role: GroupRole): Promise<Group> {
    const j = await client.patch<{ data: Group }>(
      `/api/groups/${encodeURIComponent(id)}/members/${encodeURIComponent(memberEmail)}`,
      { role }
    );
    return j.data;
  },

  async removeMember(id: string, memberEmail: string): Promise<Group> {
    const j = await client.delete<{ data: Group }>(
      `/api/groups/${encodeURIComponent(id)}/members/${encodeURIComponent(memberEmail)}`
    );
    return j.data;
  }
};
