import { Request, Response } from 'express';
import * as financeRecordService from '../services/financeRecord.service';

// Get all finance records
export const getFinanceRecords = async (req: Request, res: Response) => {
  try {
    const records = await financeRecordService.getAllFinanceRecords();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch records' });
  }
};

// Add a new finance record
export const createFinanceRecord = async (req: Request, res: Response) => {
  try {
    const record = await financeRecordService.createFinanceRecord(req.body);
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create record', details: err });
  }
};

// Delete a finance record
export const deleteFinanceRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await financeRecordService.deleteFinanceRecord(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete record', details: err });
  }
};

// Update a finance record
export const updateFinanceRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await financeRecordService.updateFinanceRecord(id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update record', details: err });
  }
};
