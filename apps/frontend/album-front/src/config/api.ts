// API Configuration with fetch
const VITE_ALBUM_API_URL = import.meta.env.VITE_ALBUM_API_URL || 'http://localhost:4002';

// Base fetch wrapper with auth handling
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('authToken');
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };

  console.log(token ? 'Adding Authorization header' : 'No auth token found in localStorage');

  const response = await fetch(`${VITE_ALBUM_API_URL}/api${endpoint}`, config);
  
  if (!response.ok) {
    console.error('API Error:', response.status, response.statusText);
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response;
}

// Helper methods for common HTTP verbs
export const albumApi = {
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
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    return { data };
  },

  async put(endpoint: string, body?: any): Promise<{ data: any }> {
    const response = await apiFetch(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    return { data };
  },

  async delete(endpoint: string): Promise<{ data: any }> {
    const response = await apiFetch(endpoint, {
      method: 'DELETE',
    });
    const data = await response.json();
    return { data };
  },
};

export default albumApi;
