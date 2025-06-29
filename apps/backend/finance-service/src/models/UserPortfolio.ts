import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPortfolio extends Document {
  symbol: string; // reference to TrackedSymbol.symbol
  quantity: number;
  avgBuyPrice: number;
  buyDate?: Date;
  notes?: string;
}

const UserPortfolioSchema: Schema = new Schema({
  symbol: { type: String, required: true },
  quantity: { type: Number, required: true },
  avgBuyPrice: { type: Number, required: true },
  buyDate: { type: Date },
  notes: { type: String }
});

export default mongoose.model<IUserPortfolio>('UserPortfolio', UserPortfolioSchema);
