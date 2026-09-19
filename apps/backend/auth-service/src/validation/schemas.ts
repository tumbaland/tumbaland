import { z } from 'zod';
import { API_KEY_SCOPES } from '@tumbaland/backend-core';

export const validateTokenSchema = z.object({
  idToken: z.string().min(1, 'Token is required')
});

export const claimPendingSignInSchema = z.object({
  nonce: z.string().min(16).max(128),
  code: z
    .string()
    .regex(/^\d{6}$/, 'The code is six digits')
    .optional()
});

export const invalidateTokensSchema = z.object({
  email: z.string().min(1, 'Email is required')
});

export const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

export const approveUserSchema = z.object({
  email: z.string().min(1, 'email required')
});

/**
 * A key's grants are fixed at creation. `tenants` is every scope of data the key
 * may reach — `personal` plus any group ids — and `defaultTenant` is the one it
 * acts in when a request names none. Both are optional here and defaulted by the
 * controller, so a client that knows nothing of tenants still gets a working
 * personal key.
 */
export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'A key needs a name').max(60),
  scopes: z
    .array(z.enum(API_KEY_SCOPES))
    .min(1, 'A key needs at least one scope')
    .max(API_KEY_SCOPES.length),
  tenants: z.array(z.string().min(1)).max(50).optional(),
  defaultTenant: z.string().min(1).optional(),
  expiresAt: z.coerce.date().min(new Date(), 'Expiry must be in the future').nullish()
});
