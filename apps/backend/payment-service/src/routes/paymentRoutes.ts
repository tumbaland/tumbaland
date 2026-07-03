import { Router } from 'express';
import { authenticateToken as authenticate } from '@tumbaland/core';
import { createOneTimePayment, listPayments } from '../controllers/paymentController';

const router = Router();

router.post('/one-time', authenticate, createOneTimePayment);
router.get('/mine', authenticate, listPayments);

export default router;
