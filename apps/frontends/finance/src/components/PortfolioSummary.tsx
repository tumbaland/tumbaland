import React from 'react';
import { PortfolioSummary as PortfolioSummaryType } from '../types/Asset';
import { formatCurrency, formatPercentage } from '../utils/formatters';

interface PortfolioSummaryProps {
  summary: PortfolioSummaryType;
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ summary }) => {
  return (
    <div className="portfolio-summary">
      <div className="summary-card">
        <h3>Portfolio Summary</h3>
        <div className="summary-stats">
          <div className="stat">
            <span className="label">Total Assets:</span>
            <span className="value">{summary.totalAssets}</span>
          </div>
          <div className="stat">
            <span className="label">Total Buy Value:</span>
            <span className="value">{formatCurrency(summary.totalBuyValue)}</span>
          </div>
          <div className="stat">
            <span className="label">Current Value:</span>
            <span className="value">{formatCurrency(summary.totalCurrentValue)}</span>
          </div>
          <div className="stat">
            <span className="label">Profit/Loss:</span>
            <span className={`value ${summary.totalProfitLoss >= 0 ? 'profit' : 'loss'}`}>
              {formatCurrency(summary.totalProfitLoss)} ({formatPercentage(summary.totalProfitLossPercentage)})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSummary;
