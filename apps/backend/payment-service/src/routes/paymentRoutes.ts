import { Router } from 'express';
import { authenticateToken as authenticate, validate } from '@tumbaland/backend-core';
import { createOneTimePayment, listPayments } from '../controllers/paymentController';
import { createOneTimePaymentSchema } from '../validation/schemas';

const router = Router();

router.post('/one-time', authenticate, validate(createOneTimePaymentSchema), createOneTimePayment);
router.get('/mine', authenticate, listPayments);

export default router;
