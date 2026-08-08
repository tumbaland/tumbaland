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
  // `canceling` = cancellation requested; access runs to the end of the paid period.
  status: 'active' | 'past_due' | 'canceled' | 'canceling' | 'incomplete';
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
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  email: string;
  name: string;
  picture?: string;
  roles?: string[];
  isApproved?: boolean;
}

export interface AuthResponse { authenticated: boolean; user: User | null; }
