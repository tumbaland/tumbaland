import { z } from 'zod';

const groupRoleSchema = z.enum(['owner', 'admin', 'member']);

// `userEmail` is only read for internal-service-to-service calls (see
// userEmail() in groupController.ts) — kept optional so it survives
// schema validation without being stripped, but ignored for normal
// user requests where identity comes from the JWT instead.
export const createGroupSchema = z.object({
  name: z.string().min(1, 'name required'),
  userEmail: z.string().optional()
});

export const updateGroupSchema = z.object({
  name: z.string().min(1, 'name required'),
  userEmail: z.string().optional()
});

export const addMemberSchema = z.object({
  email: z.string().min(1, 'email required'),
  role: groupRoleSchema.optional(),
  userEmail: z.string().optional()
});

export const updateRoleSchema = z.object({
  role: groupRoleSchema,
  userEmail: z.string().optional()
});
