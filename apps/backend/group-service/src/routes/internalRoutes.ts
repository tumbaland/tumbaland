import { Router } from 'express';
import { requireInternalServiceToken } from '@tumbaland/backend-core';
import { getOwner } from '../controllers/groupController';

/**
 * Service-to-service surface. No user JWT is involved and no browser ever
 * reaches these routes — the shared internal-token middleware verifies the
 * token itself (constant-time) rather than treating the header's presence as
 * authentication, which is what `internalServiceTokenBypass` on `/api` does.
 */
const router = Router();

router.use(requireInternalServiceToken);
router.get('/groups/:id/owner', getOwner);

export default router;
