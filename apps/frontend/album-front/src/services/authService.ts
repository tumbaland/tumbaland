/**
 * Functional Auth Service Integration for Album App
 * Follows the same pattern as albumService and photoService
 */

import { User, AuthResponse } from '../types';

// Configuration
const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:5001';
const AUTH_FRONT_URL = import.meta.env.VITE_AUTH_FRONT_URL || 'http://localhost:3004';

export const authService = {
  // Check authentication status
  async checkAuth(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${AUTH_SERVICE_URL}/auth/verify`, {
        credentials: 'include',
      });

      const data = await response.json();
      return {
        authenticated: data.success && data.authenticated,
        user: data.user || null,
      };
    } catch (error) {
      console.error('Auth check failed:', error);
      return { authenticated: false, user: null };
    }
  },

  // Redirect to login page
  redirectToLogin(returnUrl?: string): void {
    const currentUrl = returnUrl || window.location.href;
    const loginUrl = `${AUTH_FRONT_URL}?redirect_uri=${encodeURIComponent(currentUrl)}`;
    window.location.href = loginUrl;
  },

  // Logout user
  async logout(): Promise<boolean> {
    try {
      const response = await fetch(`${AUTH_SERVICE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

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

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const authResult = await this.checkAuth();
    return authResult.authenticated;
  }
};
