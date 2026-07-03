/**
 * Auth utilities for other services in the Tumbaland ecosystem
 * This file can be copied to other services or published as a shared package
 */

import { logger } from '@tumbaland/core';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthResponse {
  success: boolean;
  authenticated: boolean;
  user?: User;
  message?: string;
}

/**
 * Check if user is authenticated by calling the auth service
 */
export const checkAuth = async (authServiceUrl = 'http://localhost:5001', token?: string): Promise<AuthResponse> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${authServiceUrl}/auth/verify`, {
      method: 'GET',
      headers,
      credentials: 'include' // Include cookies
    });

    return await response.json();
  } catch (error) {
    logger.error('Auth check failed', { error: (error as Error)?.message });
    return {
      success: false,
      authenticated: false,
      message: 'Failed to check authentication'
    };
  }
};

/**
 * Redirect to auth service for login
 */
export const redirectToLogin = (authFrontUrl = 'http://localhost:3004', returnUrl?: string): void => {
  const currentUrl = returnUrl || window.location.href;
  const loginUrl = `${authFrontUrl}?redirect_uri=${encodeURIComponent(currentUrl)}`;
  window.location.href = loginUrl;
};

/**
 * Logout user by calling auth service
 */
export const logout = async (authServiceUrl = 'http://localhost:5001'): Promise<boolean> => {
  try {
    const response = await fetch(`${authServiceUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    logger.error('Logout failed', { error: (error as Error)?.message });
    return false;
  }
};

/**
 * Get user profile from auth service
 */
export const getUserProfile = async (
  authServiceUrl = 'http://localhost:5001',
  token?: string
): Promise<User | null> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${authServiceUrl}/auth/profile`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    const data = await response.json();
    return data.success ? data.user : null;
  } catch (error) {
    logger.error('Failed to get user profile', { error: (error as Error)?.message });
    return null;
  }
};
