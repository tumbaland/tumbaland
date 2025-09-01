import mongoose, { Schema, Document } from 'mongoose';

export interface IFinanceRecord extends Document {
  date: Date;
  secondPillar: number;
  secondPillarGain: number;
  thirdPillar: number;
  thirdPillarGain: number;
  etfPortfolio: number;
  etfGain: number;
  cash: number;
  gold: number;
  userId: string; // User ID who created the record
  groupId?: string; // Optional group association
}

const FinanceRecordSchema: Schema = new Schema({
  date: { type: Date, required: true },
  secondPillar: { type: Number, required: true },
  secondPillarGain: { type: Number, required: true },
  thirdPillar: { type: Number, required: true },
  thirdPillarGain: { type: Number, required: true },
  etfPortfolio: { type: Number, required: true },
  etfGain: { type: Number, required: true },
  cash: { type: Number, required: true },
  gold: { type: Number, required: true },
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  groupId: { 
    type: String, 
    index: true 
  }
});

export default mongoose.model<IFinanceRecord>('FinanceRecord', FinanceRecordSchema);
