/**
 * Functional Auth Service Integration for Album App
 * Follows the same pattern as albumService and photoService
 */

import { User, AuthResponse } from '../types';
import { getGlobalConfig } from '../config/ConfigProvider';
import { getCorrelationId, getSessionId } from '@tumbaland/components';

// Helper to read JWT token from cookie
function getJwtTokenFromCookie(cookieName = 'access_token'): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
  return match ? match[2] : null;
}

// Sync JWT token from cookie to localStorage
function syncJwtToken(): void {
  const token = getJwtTokenFromCookie();
  console.log('token', token);
  if (token && localStorage.getItem('authToken') !== token) {
    localStorage.setItem('authToken', token);
  }
}

export const authService = {
  // Initialize auth service (sync JWT from cookie)
  init(): void {
    syncJwtToken();
  },

  // Get JWT token from localStorage
  getToken(): string | null {
    return localStorage.getItem('authToken');
  },

  // Sync JWT token from cookie to localStorage
  syncToken(): void {
    syncJwtToken();
  },

  // Check authentication status (cached to prevent multiple calls)
  _authCache: null as AuthResponse | null,
  _authCacheTime: 0,
  _authCacheTimeout: 5 * 60 * 1000, // 5 minutes

  async checkAuth(): Promise<AuthResponse> {
    // Return cached result if still valid
    const now = Date.now();
    if (this._authCache && (now - this._authCacheTime) < this._authCacheTimeout) {
      return this._authCache;
    }

    try {
      const config = getGlobalConfig();
      const response = await fetch(`${config.AUTH_SERVICE_URL}/auth/verify`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': getCorrelationId(),
          'x-session-id': getSessionId()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const result: AuthResponse = {
        authenticated: data.success && data.authenticated,
        user: data.user || null
      };

      // Cache the result
      this._authCache = result;
      this._authCacheTime = now;

      return result;
    } catch (error) {
      console.error('Auth check failed:', error);
      const result: AuthResponse = { authenticated: false, user: null };
      
      // Cache failed result for shorter time
      this._authCache = result;
      this._authCacheTime = now;
      
      return result;
    }
  },

  // Get current user from JWT token (no API call needed)
  getCurrentUserFromToken(): User | null {
    try {
      const token = this.getToken();
      if (!token) return null;
      
      // Decode JWT to get user data
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload && payload.email) {
        return {
          id: payload.id,
          email: payload.email,
          name: payload.name,
          picture: payload.picture
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to decode JWT token:', error);
      return null;
    }
  },

  // Clear auth cache (useful after logout or token changes)
  clearAuthCache(): void {
    this._authCache = null;
    this._authCacheTime = 0;
  },

  // Redirect to login page
  redirectToLogin(returnUrl?: string): void {
    const config = getGlobalConfig();
    const currentUrl = returnUrl || window.location.href;
    const loginUrl = `${config.AUTH_FRONT_URL}?redirect_uri=${encodeURIComponent(currentUrl)}`;
    window.location.href = loginUrl;
  },

  // Logout user
  async logout(): Promise<boolean> {
    try {
      const config = getGlobalConfig();
      const response = await fetch(`${config.AUTH_SERVICE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': getCorrelationId(),
          'x-session-id': getSessionId()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Clear local storage auth token and cache
        localStorage.removeItem('authToken');
        this.clearAuthCache();
        window.location.reload(); // Refresh the page after logout
      }
      return data.success;
    } catch (error) {
      console.error('Logout failed:', error);
      return false;
    }
  },

  // Get current user info (uses JWT decoding first)
  async getCurrentUser(): Promise<User | null> {
    // Try to get user from JWT token first
    const tokenUser = this.getCurrentUserFromToken();
    if (tokenUser) {
      return tokenUser;
    }
    
    // Fallback to API call
    const authResult = await this.checkAuth();
    return authResult.user;
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const authResult = await this.checkAuth();
    return authResult.authenticated;
  }
};
