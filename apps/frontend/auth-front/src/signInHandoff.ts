import { authApi } from './services/authApi';

/**
 * Remembers a Google sign-in this page started, so it can be collected if it
 * finishes in another window.
 *
 * On an iPhone home-screen app, Google's page opens in a Safari sheet with its
 * own cookies. auth-service then parks the sign-in and the sheet shows a code;
 * back in the app this page still has the nonce saved here, and collects the
 * sign-in with it and the code (see claimPendingSignIn in auth-service).
 */

const STORAGE_KEY = 'tumbaland.pendingSignIn';
/** A minute longer than auth-service keeps the parked sign-in. */
const MAX_AGE_MS = 6 * 60 * 1000;

export interface StartedSignIn {
  nonce: string;
  redirect: string;
}

export type ClaimStatus = 'none' | 'code_required' | 'signed_in';

export function rememberSignIn(signIn: StartedSignIn): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...signIn, startedAt: Date.now() }));
  } catch {
    // Storage can be unavailable (private mode); the cookie path still works.
  }
}

export function startedSignIn(): StartedSignIn | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as StartedSignIn & { startedAt: number };
    if (!saved.nonce || Date.now() - saved.startedAt > MAX_AGE_MS) return null;
    return { nonce: saved.nonce, redirect: saved.redirect };
  } catch {
    return null;
  }
}

export function forgetSignIn(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/** Throws with auth-service's message when the code is wrong. */
export async function claimSignIn(nonce: string, code?: string): Promise<ClaimStatus> {
  const data = await authApi.post<{ status: ClaimStatus }>('/auth/google/claim', code ? { nonce, code } : { nonce });
  return data.status;
}
