import { Router } from 'express';
import { authenticateToken as authenticate, validate } from '@tumbaland/core';
import { getMySubscription, listMySubscriptions, cancelSubscription } from '../controllers/subscriptionController';
import { getCheckoutSessionStatus, createCheckoutSession } from '../controllers/stripeController';
import { createCheckoutSessionSchema } from '../validation/schemas';

const router = Router();

router.get('/me', authenticate, getMySubscription);
router.get('/mine', authenticate, listMySubscriptions);
// Deprecated direct start (kept for admin/testing). Consider adding role guard.
router.post('/cancel', authenticate, cancelSubscription);
router.get('/checkout-session/:id', authenticate, getCheckoutSessionStatus);
router.post('/checkout-session', authenticate, validate(createCheckoutSessionSchema), createCheckoutSession);

export default router;
