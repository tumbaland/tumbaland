import { accountApi } from './accountApi';

/** One signed-in device, as auth-service's /auth/sessions describes it. */
export interface Device {
  id: string;
  /** e.g. "Safari on iPhone", read from the browser's User-Agent. */
  device: string;
  /** ISO country code the device was last seen from, when known. */
  country: string | null;
  method: 'google' | 'unknown';
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  /** The device making this request. */
  current: boolean;
}

interface Wrapped<T> {
  success: boolean;
  data: T;
}

export const deviceService = {
  async list(): Promise<Device[]> {
    const response = await accountApi.get<Wrapped<Device[]>>('/auth/sessions');
    return response.data;
  },

  /** Resolves to whether this browser was the one signed out. */
  async signOut(id: string): Promise<boolean> {
    const response = await accountApi.delete<Wrapped<{ signedOut: boolean }>>(`/auth/sessions/${id}`);
    return response.data.signedOut;
  },

  /** Resolves to how many devices were signed out. */
  async signOutOthers(): Promise<number> {
    const response = await accountApi.post<Wrapped<{ revoked: number }>>('/auth/sessions/revoke-others', {});
    return response.data.revoked;
  }
};
