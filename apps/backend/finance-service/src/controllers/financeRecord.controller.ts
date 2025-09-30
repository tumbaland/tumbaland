import { Request, Response } from 'express';
import * as financeRecordService from '../services/financeRecord.service';

// Get all finance records
export const getFinanceRecords = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    let records;
    if (groupId) {
      // Get records for specific group (user must be member)
      records = await financeRecordService.getFinanceRecordsByGroup(groupId as string, user.id, userGroups);
    } else {
      // No groupId specified: show only personal records (no group)
      records = await financeRecordService.getPersonalFinanceRecords(user.id);
    }
    
    res.json(records);
  } catch (err: any) {
    if (err.message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(500).json({ error: 'Failed to fetch records' });
    }
  }
};

// Add a new finance record
export const createFinanceRecord = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const recordData = {
      ...req.body,
      userId: user.id
    };
    const record = await financeRecordService.createFinanceRecord(recordData);
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create record', details: err });
  }
};

// Delete a finance record
export const deleteFinanceRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    await financeRecordService.deleteFinanceRecord(id, user.id, userGroups);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else if (err.message === 'Record not found') {
      res.status(404).json({ error: 'Record not found' });
    } else {
      res.status(400).json({ error: 'Failed to delete record', details: err });
    }
  }
};

// Update a finance record
export const updateFinanceRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const updated = await financeRecordService.updateFinanceRecord(id, req.body, user.id, userGroups);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else if (err.message === 'Record not found') {
      res.status(404).json({ error: 'Record not found' });
    } else {
      res.status(400).json({ error: 'Failed to update record', details: err });
    }
  }
};
