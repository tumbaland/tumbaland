import axios, { AxiosInstance, AxiosResponse } from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_RELATIONSHIP_API_URL || 'http://localhost:4001/api';

// Helper to read JWT token from cookie
function getJwtTokenFromCookie(cookieName = 'access_token') {
  const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
  return match ? match[2] : null;
}

// On app load, read JWT from cookie and save to localStorage if not already present
(function syncJwtToken() {
  const token = getJwtTokenFromCookie();
  if (token && localStorage.getItem('authToken') !== token) {
    localStorage.setItem('authToken', token);
  }
})();

// Create axios instance with default configuration
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth tokens
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Axios always provides config.headers as AxiosHeaders, but for type safety:
      if (typeof config.headers?.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else if (config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.error('Unauthorized access - redirecting to login');
      // Could redirect to login page here
    } else if (error.response?.status >= 500) {
      console.error('Server error:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
