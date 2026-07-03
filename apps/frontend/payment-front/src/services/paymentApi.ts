import { getGlobalConfig } from '../config/ConfigProvider';
import { getCorrelationId, getSessionId } from '@tumbaland/components';
import { Plan, Subscription, Payment } from '../types';

// Unified API response shapes we might encounter from the backend.
type AnyApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  plan?: Plan;
  plans?: Plan[];
  subscription?: Subscription | null;
  payments?: Payment[];
  payment?: Payment;
  [k: string]: any; // tolerate extra fields
};

/**
 * Build the normalized base URL (no trailing slash) and append /api + path
 */
function buildUrl(path: string): string {
  const cfg = getGlobalConfig();
  const root = (cfg.PAYMENT_API_URL || '').replace(/\/$/, '');
  return `${root}/api${path}`;
}

/**
 * Extract the relevant payload entity from a heterogeneous API response.
 * Falls back to returning the raw response if no known wrapper key is present.
 */
function unwrap<T>(data: AnyApiResponse): T {
  if (data.plans) return data.plans as T;
  if (data.plan) return data.plan as T;
  if (data.subscriptions) return data.subscriptions as T;
  // Don't collapse wrapper if it includes session status fields; return full object for polling endpoint
  const hasWrapperStatus = ('status' in data && 'payment_status' in data);
  if (Object.prototype.hasOwnProperty.call(data, 'subscription') && !hasWrapperStatus) {
    // Preserve wrapper for checkout session creation so we keep sessionId/url/free flags
    if (data.free || data.sessionId || data.url) {
      return data as unknown as T;
    }
    return data.subscription as T;
  }
  if (data.payments) return data.payments as T;
  if (data.payment) return data.payment as T;
  return data as unknown as T; // final fallback
}

/**
 * Core fetch helper adding auth token + credentials and improved error surface.
 */
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Merge headers, allowing caller overrides.
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-correlation-id': getCorrelationId(),
    'x-session-id': getSessionId(),
    ...(options.headers as Record<string, string> | undefined)
  };

  const response = await fetch(buildUrl(path), {
    ...options,
    credentials: 'include',
    headers: mergedHeaders
  });

  let body: AnyApiResponse | undefined;
  const text = await response.text();
  try {
    body = text ? (JSON.parse(text) as AnyApiResponse) : {};
  } catch (e) {
    // Non-JSON response: treat as error unless OK and expecting empty
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (non-JSON)`);
    }
    return {} as T;
  }

  if (!response.ok) {
    const msg = body?.message || body?.error || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  return unwrap<T>(body || {});
}

export const paymentApi = {
  listPlans(): Promise<Plan[]> {
    return api<Plan[]>('/plans');
  },
  createCheckoutSession(planCode: string, successUrl?: string, cancelUrl?: string): Promise<{ sessionId?: string; url?: string; free?: boolean; subscription?: Subscription; }> {
    return api<{ sessionId?: string; url?: string; free?: boolean; subscription?: Subscription; }>('/subscriptions/checkout-session', {
      method: 'POST',
      body: JSON.stringify({ planCode, successUrl, cancelUrl })
    });
  },
  getCheckoutSessionStatus(sessionId: string): Promise<{ success?: boolean; status: string; payment_status: string; subscription: Subscription | null; }> {
    return api<{ success?: boolean; status: string; payment_status: string; subscription: Subscription | null; }>(`/subscriptions/checkout-session/${sessionId}`);
  },
  getMySubscription(): Promise<Subscription | null> {
    return api<Subscription | null>('/subscriptions/me');
  },
  listMySubscriptions(): Promise<Subscription[]> {
    return api<Subscription[]>('/subscriptions/mine');
  },
  cancelSubscription(): Promise<Subscription> {
    return api<Subscription>('/subscriptions/cancel', { method: 'POST' });
  },
  createOneTime(amountCents: number, currency = 'eur'): Promise<Payment> {
    return api<Payment>('/payments/one-time', {
      method: 'POST',
      body: JSON.stringify({ amountCents, currency })
    });
  },
  listMyPayments(): Promise<Payment[]> {
    return api<Payment[]>('/payments/mine');
  }
};
