import { Router } from 'express';
import {
  getFinanceRecords,
  createFinanceRecord,
  deleteFinanceRecord,
  updateFinanceRecord
} from '../controllers/financeRecord.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getFinanceRecords);
router.post('/', authenticateToken, createFinanceRecord);
router.delete('/:id', authenticateToken, deleteFinanceRecord);
router.put('/:id', authenticateToken, updateFinanceRecord);

export default router;
