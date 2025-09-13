/**
 * Functional Auth Service Integration for Album App
 * Follows the same pattern as albumService and photoService
 */

import { AuthResponse, User } from '../types';
import { getGlobalConfig } from '../config/ConfigProvider';

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

  // Check authentication status
  async checkAuth(): Promise<AuthResponse> {
    try {
      const config = getGlobalConfig();
      const response = await fetch(`${config.AUTH_SERVICE_URL}/auth/verify`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        authenticated: data.success && data.authenticated,
        user: data.user || null
      };
    } catch (error) {
      console.error('Auth check failed:', error);
      return { authenticated: false, user: null };
    }
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
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Clear local storage auth token
        localStorage.removeItem('authToken');
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

  // Get full profile info including firstName and lastName
  async getProfile(): Promise<User | null> {
    try {
      const config = getGlobalConfig();
      
      const response = await fetch(`${config.AUTH_SERVICE_URL}/auth/profile`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Profile fetch error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.user : null;
    } catch (error) {
      console.error('Get profile failed:', error);
      return null;
    }
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const authResult = await this.checkAuth();
    return authResult.authenticated;
  }
};
