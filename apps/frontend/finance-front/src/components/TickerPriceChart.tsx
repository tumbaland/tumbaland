import React from 'react';
import { Box } from '@mui/material';
import type { TickerPriceHistory } from '../services/tickerPriceHistoryService';

interface TickerPriceChartProps {
  width: number;
  /** Every closing price in range, in date order. */
  prices: TickerPriceHistory[];
  /** The same series thinned for the line, so a long history stays light. */
  linePoints: TickerPriceHistory[];
  minPrice: number;
  maxPrice: number;
  /** A dot per price, which only reads well over a short range. */
  showDots: boolean;
}

/** Closing prices as a line over a grid, drawn by hand in SVG. */
export const TickerPriceChart: React.FC<TickerPriceChartProps> = ({
  width: containerWidth,
  prices: filteredHistory,
  linePoints: chartHistory,
  minPrice,
  maxPrice,
  showDots
}) => (
  <Box sx={{ width: '100%', mb: 2, position: 'relative', height: 300 }}>
    <svg
      width={containerWidth}
      height={300}
      viewBox={`0 0 ${containerWidth} 300`}
      style={{ display: 'block', width: '100%', height: 300, maxWidth: '100%' }}
    >
      {/* Grid lines */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      {/* Y-axis labels and grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const value = minPrice + (maxPrice - minPrice) * ratio;
        const y = 300 - 60 - ((value - minPrice) / (maxPrice - minPrice || 1)) * (300 - 2 * 60);
        return (
          <g key={ratio}>
            <line x1={60} y1={y} x2={containerWidth - 60} y2={y} stroke="#e0e0e0" strokeWidth="1" />
            <text
              x={60 - 10}
              y={y + 4}
              textAnchor="end"
              fontSize="12"
              fill="#666"
              style={{ fontSize: window.innerWidth < 600 ? 10 : 12 }}
            >
              {value.toFixed(2)}
            </text>
          </g>
        );
      })}
      {/* X-axis labels (dates evenly spaced) */}
      {filteredHistory.map((item, i) => {
        if (i % Math.ceil(filteredHistory.length / 7) !== 0 && i !== filteredHistory.length - 1) return null;
        const x = 60 + (i * (containerWidth - 2 * 60)) / (filteredHistory.length - 1 || 1);
        return (
          <text
            key={item.date}
            x={x}
            y={300 - 60 + 20}
            textAnchor="middle"
            fontSize={window.innerWidth < 600 ? 10 : 12}
            fill="#666"
          >
            {new Date(item.date).toLocaleDateString()}
          </text>
        );
      })}
      {/* Line for close price */}
      {chartHistory.length > 1 && (
        <path
          d={chartHistory
            .map((item, i) => {
              const x = 60 + (i * (containerWidth - 2 * 60)) / (chartHistory.length - 1 || 1);
              const y = 300 - 60 - ((item.price - minPrice) / (maxPrice - minPrice || 1)) * (300 - 2 * 60);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            })
            .join(' ')}
          fill="none"
          stroke="#1976d2"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Data points: only draw for < 1 year range */}
      {showDots &&
        filteredHistory.map((item, i) => {
          const x = 60 + (i * (containerWidth - 2 * 60)) / (filteredHistory.length - 1 || 1);
          const y = 300 - 60 - ((item.price - minPrice) / (maxPrice - minPrice || 1)) * (300 - 2 * 60);
          return (
            <g key={item.date}>
              <circle cx={x} cy={y} r={window.innerWidth < 600 ? 3 : 5} fill="#1976d2" stroke="#fff" strokeWidth="2">
                <title>{`${new Date(item.date).toLocaleDateString()}: ${item.price.toFixed(2)}`}</title>
              </circle>
            </g>
          );
        })}
    </svg>
  </Box>
);
