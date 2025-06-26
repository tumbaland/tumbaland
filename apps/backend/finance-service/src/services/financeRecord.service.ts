import FinanceRecord, { IFinanceRecord } from '../models/FinanceRecord';

export const getAllFinanceRecords = async () => {
  return FinanceRecord.find().sort({ date: 1 });
};

export const createFinanceRecord = async (data: Partial<IFinanceRecord>) => {
  const record = new FinanceRecord(data);
  return record.save();
};

export const deleteFinanceRecord = async (id: string) => {
  return FinanceRecord.findByIdAndDelete(id);
};

export const updateFinanceRecord = async (id: string, data: Partial<IFinanceRecord>) => {
  return FinanceRecord.findByIdAndUpdate(id, data, { new: true });
};
