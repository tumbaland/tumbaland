/** `-1` means unlimited, on every ceiling in here. */
export interface PlanLimits {
  meters: Record<string, number>;
  features: Record<string, boolean>;
  retentionDays: number;
}

export interface Plan {
  _id?: string;
  name: string;
  code: string;
  description?: string;
  priceMonthlyCents?: number;
  priceYearlyCents?: number;
  features?: string[];
  isActive?: boolean;
  /**
   * False for plans that exist but are not sold — the staff plan. The API only
   * ever returns one of these to a user who is actually on it.
   */
  isPublic?: boolean;
  /** Limits after plan document and code defaults are resolved. What is enforced. */
  effectiveLimits?: PlanLimits;
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
  /** Granted by an admin rather than bought — staff and comped friends. Never billed. */
  isComp?: boolean;
  grantedBy?: string;
  grantReason?: string;
  /** When a grant lapses, if it was given a limit. */
  expiresAt?: string;
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
