import React from 'react';
import { Asset } from '../types/Asset';
import { formatCurrency, formatPercentage, formatDate } from '../utils/formatters';

interface AssetsTableProps {
  assets: Asset[];
}

const AssetsTable: React.FC<AssetsTableProps> = ({ assets }) => {
  if (assets.length === 0) {
    return (
      <div className="assets-table-container">
        <h3>Assets</h3>
        <p className="no-assets">No assets found. Create some assets using the API.</p>
      </div>
    );
  }

  return (
    <div className="assets-table-container">
      <h3>Assets</h3>
      <table className="assets-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Quantity</th>
            <th>Buy Price</th>
            <th>Current Price</th>
            <th>Buy Value</th>
            <th>Current Value</th>
            <th>P&L</th>
            <th>P&L %</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const buyValue = asset.quantity * asset.buyPrice;
            const currentValue = asset.quantity * asset.currentPrice;
            const profitLoss = currentValue - buyValue;
            const profitLossPercentage = buyValue > 0 ? ((profitLoss / buyValue) * 100) : 0;

            return (
              <tr key={asset._id}>
                <td className="asset-name">{asset.name}</td>
                <td>{asset.quantity}</td>
                <td>{formatCurrency(asset.buyPrice)}</td>
                <td>{formatCurrency(asset.currentPrice)}</td>
                <td>{formatCurrency(buyValue)}</td>
                <td>{formatCurrency(currentValue)}</td>
                <td className={profitLoss >= 0 ? 'profit' : 'loss'}>
                  {formatCurrency(profitLoss)}
                </td>
                <td className={profitLoss >= 0 ? 'profit' : 'loss'}>
                  {formatPercentage(profitLossPercentage)}
                </td>
                <td>{formatDate(asset.date)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AssetsTable;
