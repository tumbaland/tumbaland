import FinanceRecord, { IFinanceRecord } from '../models/FinanceRecord';
import { buildAccessQuery, canAccessResource } from '../utils/permissionUtils';

export const getAllFinanceRecords = async () => {
  return FinanceRecord.find().sort({ date: 1 });
};

export const getFinanceRecordsByUser = async (userId: string, groupIds: string[] = []) => {
  const query = buildAccessQuery(userId, groupIds, false);
  return FinanceRecord.find(query).sort({ date: 1 });
};

export const getPersonalFinanceRecords = async (userId: string) => {
  // Get only personal records (no group association)
  return FinanceRecord.find({ 
    userId,
    groupId: { $exists: false }
  }).sort({ date: 1 });
};

export const getFinanceRecordsByGroup = async (groupId: string, userId: string, userGroupIds: string[]) => {
  // Check if user has access to the group
  if (!userGroupIds.includes(groupId)) {
    throw new Error('ACCESS_DENIED');
  }
  
  return FinanceRecord.find({ groupId }).sort({ date: 1 });
};

export const createFinanceRecord = async (data: Partial<IFinanceRecord>) => {
  const record = new FinanceRecord(data);
  return record.save();
};

export const deleteFinanceRecord = async (id: string, userId: string, userGroupIds: string[] = []) => {
  const record = await FinanceRecord.findById(id);
  if (!record) {
    throw new Error('Record not found');
  }
  
  const hasAccess = canAccessResource(
    userId, 
    record.userId, 
    record.groupId,
    userGroupIds,
    false
  );
  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }
  
  return FinanceRecord.findByIdAndDelete(id);
};

export const updateFinanceRecord = async (id: string, data: Partial<IFinanceRecord>, userId: string, userGroupIds: string[] = []) => {
  const record = await FinanceRecord.findById(id);
  if (!record) {
    throw new Error('Record not found');
  }
  
  const hasAccess = canAccessResource(
    userId, 
    record.userId, 
    record.groupId,
    userGroupIds,
    false
  );
  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }
  
  return FinanceRecord.findByIdAndUpdate(id, data, { new: true });
};
