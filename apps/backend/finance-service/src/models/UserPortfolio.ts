import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPortfolio extends Document {
  _id: string;
  symbol: string; // reference to TrackedSymbol.symbol
  quantity: number;
  avgBuyPrice: number;
  buyDate?: Date;
  notes?: string;
  userId: string; // User ID who created the portfolio entry
  groupId?: string; // Optional group association
}

const UserPortfolioSchema: Schema = new Schema({
  symbol: { type: String, required: true },
  quantity: { type: Number, required: true },
  avgBuyPrice: { type: Number, required: true },
  buyDate: { type: Date },
  notes: { type: String },
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

export default mongoose.model<IUserPortfolio>('UserPortfolio', UserPortfolioSchema);
