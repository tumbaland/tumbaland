import { z } from 'zod';
import { API_KEY_SCOPES } from '@tumbaland/backend-core';

export const validateTokenSchema = z.object({
  idToken: z.string().min(1, 'Token is required')
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
 * A key's grants are fixed at creation. `groupId` is the tenant the key acts in
 * — omitted or null means the creator's own non-group data — and an empty string
 * is accepted as the same thing, since that is what an unset <Select> submits.
 */
export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'A key needs a name').max(60),
  scopes: z
    .array(z.enum(API_KEY_SCOPES))
    .min(1, 'A key needs at least one scope')
    .max(API_KEY_SCOPES.length),
  groupId: z.string().or(z.literal('')).nullish(),
  expiresAt: z.coerce.date().min(new Date(), 'Expiry must be in the future').nullish()
});
