/**
 * Functional Auth Service Integration for Album App
 * Follows the same pattern as albumService and photoService
 */

import { AuthResponse, User } from '../types';
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
  // Cache for auth responses
  _authCache: {
    data: null as AuthResponse | null,
    timestamp: 0
  },

  // Cache TTL in milliseconds (5 minutes)
  CACHE_TTL: 5 * 60 * 1000,

  // Decode JWT token and extract user data
  getCurrentUserFromToken(): User | null {
    try {
      const token = this.getToken();
      if (!token) return null;

      // Decode JWT payload (base64url decode)
      const payload = token.split('.')[1];
      if (!payload) return null;

      const decodedPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));

      // Check if token is expired
      if (decodedPayload.exp && Date.now() >= decodedPayload.exp * 1000) {
        return null;
      }

      // Extract user data from JWT payload
      return {
        id: decodedPayload.sub || decodedPayload.id,
        email: decodedPayload.email,
        name: decodedPayload.name || decodedPayload.preferred_username,
        picture: decodedPayload.picture
      };
    } catch (error) {
      console.error('Failed to decode JWT token:', error);
      return null;
    }
  },
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

  // Check authentication status with caching
  async checkAuth(): Promise<AuthResponse> {
    // Check cache first
    const now = Date.now();
    if (this._authCache.data && (now - this._authCache.timestamp) < this.CACHE_TTL) {
      return this._authCache.data;
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
      const authResponse: AuthResponse = {
        authenticated: data.success && data.authenticated,
        user: data.user || null
      };

      // Cache the response
      this._authCache = {
        data: authResponse,
        timestamp: now
      };

      return authResponse;
    } catch (error) {
      console.error('Auth check failed:', error);
      const errorResponse: AuthResponse = { authenticated: false, user: null };

      // Cache error responses for a shorter time (1 minute)
      this._authCache = {
        data: errorResponse,
        timestamp: now
      };

      return errorResponse;
    }
  },

  // Redirect to login page
  redirectToLogin(returnUrl?: string): void {
    const config = getGlobalConfig();
    const currentUrl = returnUrl || window.location.href;
    const loginUrl = `${config.AUTH_FRONT_URL}?redirect_uri=${encodeURIComponent(currentUrl)}`;
    window.location.href = loginUrl;
  },

  // Clear auth cache
  clearAuthCache(): void {
    this._authCache = {
      data: null,
      timestamp: 0
    };
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

  // Get current user info
  async getCurrentUser(): Promise<User | null> {
    const authResult = await this.checkAuth();
    return authResult.user;
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const authResult = await this.checkAuth();
    return authResult.authenticated;
  }
};
