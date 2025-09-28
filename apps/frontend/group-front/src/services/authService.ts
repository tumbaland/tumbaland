import { AuthResponse, User } from '../types';
import { getGlobalConfig } from '../config/ConfigProvider';
import { getCorrelationId, getSessionId } from '@tumbaland/components';

function getJwtTokenFromCookie(cookieName = 'access_token'): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
  return match ? match[2] : null;
}
function syncJwtToken(): void {
  const token = getJwtTokenFromCookie();
  if (token && localStorage.getItem('authToken') !== token) {
    localStorage.setItem('authToken', token);
  }
}

export const authService = {
  init(): void { syncJwtToken(); },
  getToken(): string | null { return localStorage.getItem('authToken'); },
  syncToken(): void { syncJwtToken(); },
  async checkAuth(): Promise<AuthResponse> {
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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { authenticated: data.success && data.authenticated, user: data.user || null };
    } catch (e) {
      console.error('Auth check failed:', e);
      return { authenticated: false, user: null };
    }
  },
  redirectToLogin(returnUrl?: string): void {
    const config = getGlobalConfig();
    const currentUrl = returnUrl || window.location.href;
    window.location.href = `${config.AUTH_FRONT_URL}?redirect_uri=${encodeURIComponent(currentUrl)}`;
  },
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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success) { localStorage.removeItem('authToken'); window.location.reload(); }
      return data.success;
    } catch (e) {
      console.error('Logout failed:', e);
      return false;
    }
  },
  async getCurrentUser(): Promise<User | null> { const r = await this.checkAuth(); return r.user; },
  async isAuthenticated(): Promise<boolean> { const r = await this.checkAuth(); return r.authenticated; }
};
