import { Router } from 'express';
import { requireInternalServiceToken } from '@tumbaland/backend-core';
import { getEntitlementsByEmail } from '../controllers/entitlementController';

/**
 * Service-to-service surface. No user JWT is involved and no browser ever
 * reaches these routes — the shared internal-token middleware verifies the
 * token itself (constant-time) rather than treating the header's presence as
 * authentication.
 */
const router = Router();

router.use(requireInternalServiceToken);
router.get('/entitlements', getEntitlementsByEmail);

export default router;
