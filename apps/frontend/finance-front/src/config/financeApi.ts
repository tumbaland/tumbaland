import { getGlobalConfig } from './ConfigProvider';
import { getCorrelationId, getSessionId } from '@tumbaland/components';

// Base fetch wrapper with auth handling
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const appConfig = getGlobalConfig();
  const token = localStorage.getItem('authToken');

  const requestConfig: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': getCorrelationId(),
      'x-session-id': getSessionId(),
      ...options.headers,
      ...(token && { Authorization: `Bearer ${token}` })
    }
  };

  console.log(token ? 'Adding Authorization header' : 'No auth token found in localStorage');

  const response = await fetch(`${appConfig.FINANCE_API_URL}/api${endpoint}`, requestConfig);

  if (!response.ok) {
    if (response.status === 401) {
      console.error('Unauthorized access - redirecting to login');
      // Handle unauthorized access
    } else if (response.status >= 500) {
      console.error('Server error:', response.status, response.statusText);
    }
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response;
}

// Helper methods for common HTTP verbs
export const financeApi = {
  async get(endpoint: string, options?: { params?: Record<string, any> }): Promise<{ data: any }> {
    let url = endpoint;
    if (options?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const paramString = searchParams.toString();
      if (paramString) {
        url += `?${paramString}`;
      }
    }

    const response = await apiFetch(url);
    const data = await response.json();
    return { data };
  },

  async post(endpoint: string, body?: any): Promise<{ data: any }> {
    const response = await apiFetch(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    return { data };
  },

  async put(endpoint: string, body?: any): Promise<{ data: any }> {
    const response = await apiFetch(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    return { data };
  },

  async delete(endpoint: string): Promise<{ data: any }> {
    const response = await apiFetch(endpoint, {
      method: 'DELETE'
    });
    const data = await response.json();
    return { data };
  }
};

export default financeApi;
