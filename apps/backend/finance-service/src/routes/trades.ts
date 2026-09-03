import { Router } from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
import { getTrades, getPosition, addTrade, editTrade, removeTrade } from '../controllers/trade.controller';
import { createTradeSchema, updateTradeSchema } from '../validation/schemas';

const router = Router();

router.use(authenticateAgent());

// Must precede /:id so "position" is not read as a trade id
router.get('/position/:ticker', requireScope('finance:read'), getPosition);
router.get('/', requireScope('finance:read'), getTrades);
router.post('/', requireScope('finance:write'), validate(createTradeSchema), addTrade);
router.put('/:id', requireScope('finance:write'), validate(updateTradeSchema), editTrade);
router.delete('/:id', requireScope('finance:write'), removeTrade);

export default router;
