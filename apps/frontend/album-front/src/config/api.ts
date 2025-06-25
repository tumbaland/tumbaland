import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_ALBUM_API_URL || 'http://localhost:4002';

// Helper to read JWT token from cookie
function getJwtTokenFromCookie(cookieName = 'access_token') {
  const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
  return match ? match[2] : null;
}

// On app load, read JWT from cookie and save to localStorage if not already present
(function syncJwtToken() {
  const token = getJwtTokenFromCookie();
  console.log('token', token)
  if (token && localStorage.getItem('authToken') !== token) {
    localStorage.setItem('authToken', token);
  }
})();

export const albumApi = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for error handling
albumApi.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    // Axios always provides config.headers as AxiosHeaders, but for type safety:
    if (token) {
      (config.headers = config.headers || {});
      // For Axios v1+, use set method if available
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      console.log('Adding Authorization header:', config.headers['Authorization'] || (config.headers.get && config.headers.get('Authorization')));
    } else {
      console.log('No auth token found in localStorage');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
albumApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default albumApi;
