import { getCorrelationId, getSessionId } from '@tumbaland/components';

export interface ApiClientOptions {
  /** Read fresh at call time (config may not be resolved yet at module load). */
  baseUrl: () => string;
  /** Called on a 401 response, e.g. to redirect to the login page. */
  onUnauthorized?: () => void;
}

export interface ApiRequestOptions extends RequestInit {
  /** Skip the onUnauthorized callback for this call (e.g. an auth-check that expects 401 as a normal "not logged in" result, not a hard redirect). */
  skipAuthRedirect?: boolean;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Generic authenticated JSON fetch wrapper — base URL handling, credentials,
 * correlation/session headers, structured errors, and an opt-in 401 →
 * redirect-to-auth hook, per TECHNICAL_REVIEW.md P1.3. `authService` and
 * `groupService` don't route through this: they use different auth
 * transports (cookie vs. Bearer token) that predate this client. New
 * call sites (the many per-front album/finance/etc. service files that
 * still hand-roll fetch) can adopt this incrementally.
 */
export function createApiClient(options: ApiClientOptions) {
  async function request<T = unknown>(path: string, init: ApiRequestOptions = {}): Promise<T> {
    const { skipAuthRedirect, headers, ...rest } = init;

    const response = await fetch(`${options.baseUrl()}${path}`, {
      credentials: 'include',
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': getCorrelationId(),
        'x-session-id': getSessionId(),
        ...headers
      }
    });

    if (response.status === 401 && !skipAuthRedirect) {
      options.onUnauthorized?.();
    }

    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        // response wasn't JSON — leave body undefined
      }
      const message = (body as { message?: string } | undefined)?.message ?? `HTTP error! status: ${response.status}`;
      throw new ApiError(response.status, message, body);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return response.json();
  }

  return {
    request,
    get: <T = unknown>(path: string, init?: ApiRequestOptions) => request<T>(path, { ...init, method: 'GET' }),
    post: <T = unknown>(path: string, body?: unknown, init?: ApiRequestOptions) =>
      request<T>(path, { ...init, method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
    put: <T = unknown>(path: string, body?: unknown, init?: ApiRequestOptions) =>
      request<T>(path, { ...init, method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
    patch: <T = unknown>(path: string, body?: unknown, init?: ApiRequestOptions) =>
      request<T>(path, { ...init, method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
    delete: <T = unknown>(path: string, init?: ApiRequestOptions) => request<T>(path, { ...init, method: 'DELETE' })
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
