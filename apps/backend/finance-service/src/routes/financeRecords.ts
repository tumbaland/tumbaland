import { Router } from 'express';
import {
  getFinanceRecords,
  createFinanceRecord,
  deleteFinanceRecord,
  updateFinanceRecord
} from '../controllers/financeRecord.controller';

const router = Router();

router.get('/', getFinanceRecords);
router.post('/', createFinanceRecord);
router.delete('/:id', deleteFinanceRecord);
router.put('/:id', updateFinanceRecord);

export default router;
