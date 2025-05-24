import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for Asset document
export interface IAsset extends Document {
  id: string;
  name: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for Asset static methods
export interface IAssetModel extends Model<IAsset> {
  getPortfolioSummary(): Promise<any[]>;
  getAssetsByDateRange(startDate: Date, endDate: Date): Promise<IAsset[]>;
  getTopPerformers(limit?: number): Promise<any[]>;
}

// Asset schema
const AssetSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(value: number) {
        return value >= 0;
      },
      message: 'Quantity must be a positive number'
    }
  },
  buyPrice: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(value: number) {
        return value >= 0;
      },
      message: 'Buy price must be a positive number'
    }
  },
  currentPrice: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(value: number) {
        return value >= 0;
      },
      message: 'Current price must be a positive number'
    }
  },
  date: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'assets'
});

// Virtual for total buy value
AssetSchema.virtual('totalBuyValue').get(function(this: IAsset) {
  return this.quantity * this.buyPrice;
});

// Virtual for total current value
AssetSchema.virtual('totalCurrentValue').get(function(this: IAsset) {
  return this.quantity * this.currentPrice;
});

// Virtual for profit/loss
AssetSchema.virtual('profitLoss').get(function(this: IAsset) {
  return (this.quantity * this.currentPrice) - (this.quantity * this.buyPrice);
});

// Virtual for profit/loss percentage
AssetSchema.virtual('profitLossPercentage').get(function(this: IAsset) {
  const totalBuyValue = this.quantity * this.buyPrice;
  if (totalBuyValue === 0) return 0;
  const totalCurrentValue = this.quantity * this.currentPrice;
  return ((totalCurrentValue - totalBuyValue) / totalBuyValue) * 100;
});

// Ensure virtual fields are serialized
AssetSchema.set('toJSON', { virtuals: true });
AssetSchema.set('toObject', { virtuals: true });

// Indexes for better query performance
AssetSchema.index({ name: 1, date: -1 });
AssetSchema.index({ date: -1 });
AssetSchema.index({ 'createdAt': -1 });

// Static methods
AssetSchema.statics.getPortfolioSummary = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalAssets: { $sum: 1 },
        totalBuyValue: { $sum: { $multiply: ['$quantity', '$buyPrice'] } },
        totalCurrentValue: { $sum: { $multiply: ['$quantity', '$currentPrice'] } }
      }
    },
    {
      $addFields: {
        totalProfitLoss: { $subtract: ['$totalCurrentValue', '$totalBuyValue'] },
        profitLossPercentage: {
          $cond: {
            if: { $eq: ['$totalBuyValue', 0] },
            then: 0,
            else: {
              $multiply: [
                { $divide: [
                  { $subtract: ['$totalCurrentValue', '$totalBuyValue'] },
                  '$totalBuyValue'
                ]},
                100
              ]
            }
          }
        }
      }
    }
  ]);
};

AssetSchema.statics.getAssetsByDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

AssetSchema.statics.getTopPerformers = function(limit: number = 5) {
  return this.aggregate([
    {
      $addFields: {
        profitLossPercentage: {
          $cond: {
            if: { $eq: [{ $multiply: ['$quantity', '$buyPrice'] }, 0] },
            then: 0,
            else: {
              $multiply: [
                { $divide: [
                  { $subtract: [
                    { $multiply: ['$quantity', '$currentPrice'] },
                    { $multiply: ['$quantity', '$buyPrice'] }
                  ]},
                  { $multiply: ['$quantity', '$buyPrice'] }
                ]},
                100
              ]
            }
          }
        }
      }
    },
    {
      $sort: { profitLossPercentage: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

export const Asset = mongoose.model<IAsset, IAssetModel>('Asset', AssetSchema);
