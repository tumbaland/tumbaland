import { Router } from 'express';
import {
  getFinanceRecords,
  createFinanceRecord,
  deleteFinanceRecord,
  updateFinanceRecord
} from '../controllers/financeRecord.controller';
import { authenticateToken } from '../middleware/authMiddleware';
import { attachUserGroups } from '../middleware/userGroupsMiddleware';

const router = Router();

// Apply authentication and group middleware to all routes
router.use(authenticateToken);
router.use(attachUserGroups);

router.get('/', getFinanceRecords);
router.post('/', createFinanceRecord);
router.delete('/:id', deleteFinanceRecord);
router.put('/:id', updateFinanceRecord);

export default router;
