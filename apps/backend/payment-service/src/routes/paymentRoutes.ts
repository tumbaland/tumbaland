import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { createOneTimePayment, listPayments } from '../controllers/paymentController';

const router = Router();

router.post('/one-time', authenticate, createOneTimePayment);
router.get('/mine', authenticate, listPayments);

export default router;
