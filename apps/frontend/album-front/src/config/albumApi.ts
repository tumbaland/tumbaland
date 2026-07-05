import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from './ConfigProvider';

const client = createApiClient({
  baseUrl: () => `${getGlobalConfig().ALBUM_API_URL}/api`,
  onUnauthorized: () => {
    const { AUTH_FRONT_URL } = getGlobalConfig();
    if (AUTH_FRONT_URL) {
      window.location.href = `${AUTH_FRONT_URL}?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
  }
});

// Helper methods for common HTTP verbs, kept axios-shaped ({ data }) so call sites don't change.
export const albumApi = {
  async get<T = unknown>(endpoint: string, options?: { params?: Record<string, any> }): Promise<{ data: T }> {
    return { data: await client.get<T>(endpoint, { params: options?.params }) };
  },

  async post<T = unknown>(endpoint: string, body?: unknown): Promise<{ data: T }> {
    return { data: await client.post<T>(endpoint, body) };
  },

  async put<T = unknown>(endpoint: string, body?: unknown): Promise<{ data: T }> {
    return { data: await client.put<T>(endpoint, body) };
  },

  async delete<T = unknown>(endpoint: string): Promise<{ data: T }> {
    return { data: await client.delete<T>(endpoint) };
  }
};

export default albumApi;
