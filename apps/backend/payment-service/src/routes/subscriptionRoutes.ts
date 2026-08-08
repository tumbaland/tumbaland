import { Router } from 'express';
import { authenticateToken as authenticate, validate } from '@tumbaland/backend-core';
import { getMySubscription, listMySubscriptions, cancelSubscription } from '../controllers/subscriptionController';
import { getCheckoutSessionStatus, createCheckoutSession } from '../controllers/stripeController';
import { getMyEntitlements } from '../controllers/entitlementController';
import { listGrants, grantSubscription, revokeGrant } from '../controllers/grantController';
import { requireAdmin } from '../middleware/adminMiddleware';
import { createCheckoutSessionSchema, grantSubscriptionSchema } from '../validation/schemas';

const router = Router();

// Comp grants (admin): a plan handed out instead of sold. Mounted before the
// `/me` routes only for readability — the paths don't collide.
router.get('/grants', authenticate, requireAdmin, listGrants);
router.post('/grants', authenticate, requireAdmin, validate(grantSubscriptionSchema), grantSubscription);
router.delete('/grants/:email', authenticate, requireAdmin, revokeGrant);

router.get('/me', authenticate, getMySubscription);
// Plan + resolved limits + live meter readings, for <UsageMeter> and the
// pricing page's live numbers.
router.get('/me/entitlements', authenticate, getMyEntitlements);
router.get('/mine', authenticate, listMySubscriptions);
// Deprecated direct start (kept for admin/testing). Consider adding role guard.
router.post('/cancel', authenticate, cancelSubscription);
router.get('/checkout-session/:id', authenticate, getCheckoutSessionStatus);
router.post('/checkout-session', authenticate, validate(createCheckoutSessionSchema), createCheckoutSession);

export default router;
