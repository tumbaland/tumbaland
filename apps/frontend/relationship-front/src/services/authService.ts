/**
 * Simple Auth Service Integration for Relationship App
 * Copy the auth service from libs/components/src/auth/authService.ts
 */

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class AuthService {
  private authServiceUrl: string;
  private authFrontUrl: string;

  constructor(
    authServiceUrl = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:5001',
    authFrontUrl = import.meta.env.VITE_AUTH_FRONT_URL || 'http://localhost:3004'
  ) {
    this.authServiceUrl = authServiceUrl;
    this.authFrontUrl = authFrontUrl;
  }

  async checkAuth(): Promise<{ authenticated: boolean; user: User | null }> {
    try {
      const response = await fetch(`${this.authServiceUrl}/auth/verify`, {
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
  }

  redirectToLogin(returnUrl?: string): void {
    const currentUrl = returnUrl || window.location.href;
    const loginUrl = `${this.authFrontUrl}?redirect_uri=${encodeURIComponent(currentUrl)}`;
    window.location.href = loginUrl;
  }

  async logout(): Promise<boolean> {
    try {
      const response = await fetch(`${this.authServiceUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        window.location.reload(); // Refresh the page after logout
      }
      return data.success;
    } catch (error) {
      console.error('Logout failed:', error);
      return false;
    }
  }
}

export const authService = new AuthService();
