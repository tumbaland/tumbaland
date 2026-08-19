import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';
import { Plan, Subscription, Payment } from '../types';

// Unified API response shapes we might encounter from the backend.
type AnyApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  plan?: Plan;
  plans?: Plan[];
  subscription?: Subscription | null;
  subscriptions?: Subscription[];
  payments?: Payment[];
  payment?: Payment;
  [k: string]: unknown; // tolerate extra fields
};

const client = createApiClient({
  baseUrl: () => `${(getGlobalConfig().PAYMENT_API_URL || '').replace(/\/$/, '')}/api`,
  onUnauthorized: () => {
    const { AUTH_FRONT_URL } = getGlobalConfig();
    if (AUTH_FRONT_URL) {
      window.location.href = `${AUTH_FRONT_URL}?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
  }
});

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

async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const body = await client.request<AnyApiResponse>(path, {
    method: options.method,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  return unwrap<T>(body || {});
}

export const paymentApi = {
  listPlans(): Promise<Plan[]> {
    return api<Plan[]>('/plans');
  },
  createCheckoutSession(planCode: string, successUrl?: string, cancelUrl?: string): Promise<{ sessionId?: string; url?: string; free?: boolean; changed?: boolean; subscription?: Subscription; }> {
    // `changed: true` means the customer already had a subscription and it was
    // switched onto this plan in place — there is no Stripe checkout to visit,
    // because there is no second subscription to buy.
    return api<{ sessionId?: string; url?: string; free?: boolean; changed?: boolean; subscription?: Subscription; }>('/subscriptions/checkout-session', {
      method: 'POST',
      body: { planCode, successUrl, cancelUrl }
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
      body: { amountCents, currency }
    });
  },
  listMyPayments(): Promise<Payment[]> {
    return api<Payment[]>('/payments/mine');
  }
};
