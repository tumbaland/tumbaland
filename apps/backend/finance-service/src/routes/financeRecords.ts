import { Router } from 'express';
import {
  getFinanceRecords,
  createFinanceRecord,
  deleteFinanceRecord,
  updateFinanceRecord
} from '../controllers/financeRecord.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication middleware (groups are now extracted from JWT)
router.use(authenticateToken);

router.get('/', getFinanceRecords);
router.post('/', createFinanceRecord);
router.delete('/:id', deleteFinanceRecord);
router.put('/:id', updateFinanceRecord);

export default router;
