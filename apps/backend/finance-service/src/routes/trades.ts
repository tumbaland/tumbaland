import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import { getTrades, getPosition, addTrade, editTrade, removeTrade } from '../controllers/trade.controller';
import { createTradeSchema, updateTradeSchema } from '../validation/schemas';

const router = Router();

router.use(authenticateToken);

// Must precede /:id so "position" is not read as a trade id
router.get('/position/:ticker', getPosition);
router.get('/', getTrades);
router.post('/', validate(createTradeSchema), addTrade);
router.put('/:id', validate(updateTradeSchema), editTrade);
router.delete('/:id', removeTrade);

export default router;
