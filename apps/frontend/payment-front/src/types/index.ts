export interface Plan {
  _id?: string;
  name: string;
  code: string;
  description?: string;
  priceMonthlyCents?: number;
  priceYearlyCents?: number;
  features?: string[];
  isActive?: boolean;
  stripePriceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subscription {
  _id?: string;
  userEmail?: string;
  planCode: string;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete';
  renewsAt?: string;
  cancelAt?: string;
  canceledAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  latestInvoiceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Payment {
  _id: string;
  userEmail?: string;
  amountCents?: number;
  currency?: string;
  type: 'subscription' | 'one_time';
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  email: string;
  name: string;
  roles?: string[];
  isApproved?: boolean;
}

export interface AuthResponse { authenticated: boolean; user: User | null; }
