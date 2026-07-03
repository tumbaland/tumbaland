import { z } from 'zod';

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
