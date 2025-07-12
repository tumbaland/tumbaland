import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { getTickerPriceHistory, TickerPriceHistory } from '../services/tickerPriceHistoryService';

interface TickerPriceHistoryInlineProps {
  ticker: string;
}

const TickerPriceHistoryInline: React.FC<TickerPriceHistoryInlineProps> = ({ ticker }) => {
  const [history, setHistory] = useState<TickerPriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [pendingStartDate, setPendingStartDate] = useState<string>('');
  const [pendingEndDate, setPendingEndDate] = useState<string>('');

  // Set default date range to this year on mount or ticker change
  useEffect(() => {
    if (!ticker) return;
    const now = new Date();
    const year = now.getFullYear();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    setStartDate(start);
    setEndDate(end);
    setPendingStartDate(start);
    setPendingEndDate(end);
  }, [ticker]);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    getTickerPriceHistory(ticker)
      .then((data) => setHistory(data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())))
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false));
  }, [ticker]);

  // Filtered history by date
  const filteredHistory = history.filter((h) => {
    const d = new Date(h.date).toISOString().slice(0, 10);
    const afterStart = !startDate || d >= startDate;
    const beforeEnd = !endDate || d <= endDate;
    return afterStart && beforeEnd;
  });

  if (!ticker) return null;

  return (
    <Paper sx={{ p: 2, mt: 2, mb: 2 }} elevation={2}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Price History for {ticker}
      </Typography>
      {loading ? (
        <Typography>Loading...</Typography>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : history.length === 0 ? (
        <Typography>No price history found.</Typography>
      ) : (
        <>
          {/* Date range pickers and apply button - responsive */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              mb: 2,
              alignItems: { xs: 'stretch', sm: 'center' },
              width: '100%'
            }}
          >
            <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <input
                type="date"
                value={pendingStartDate}
                onChange={(e) => setPendingStartDate(e.target.value)}
                style={{ minWidth: 120, width: '100%', padding: 8, boxSizing: 'border-box' }}
              />
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <input
                type="date"
                value={pendingEndDate}
                onChange={(e) => setPendingEndDate(e.target.value)}
                style={{ minWidth: 120, width: '100%', padding: 8, boxSizing: 'border-box' }}
              />
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <button
                style={{ height: 40, width: '100%', maxWidth: 120, marginTop: 0 }}
                onClick={(e) => {
                  e.preventDefault();
                  setStartDate(pendingStartDate);
                  setEndDate(pendingEndDate);
                }}
              >
                Apply Filters
              </button>
            </Box>
          </Box>
          <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto' }}>
            {/* Inline SVG chart, mobile friendly */}
            <svg
              width="100%"
              height={220}
              viewBox="0 0 360 220"
              style={{ display: 'block', width: '100%', height: 220 }}
            >
              {/* Grid lines */}
              <defs>
                <pattern id="grid-inline" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-inline)" />
              {/* Y-axis labels and grid */}
              {(() => {
                const prices = filteredHistory.map((h) => h.close);
                const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                const maxPrice = prices.length > 0 ? Math.max(...prices) : 1;
                return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const value = minPrice + (maxPrice - minPrice) * ratio;
                  const y = 220 - 40 - ((value - minPrice) / (maxPrice - minPrice || 1)) * (220 - 2 * 40);
                  return (
                    <g key={ratio}>
                      <line x1={40} y1={y} x2={360 - 40} y2={y} stroke="#e0e0e0" strokeWidth="1" />
                      <text x={40 - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#666">
                        {value.toFixed(2)}
                      </text>
                    </g>
                  );
                });
              })()}
              {/* X-axis labels (dates evenly spaced) */}
              {filteredHistory.map((item, i) => {
                if (i % Math.ceil(filteredHistory.length / 5) !== 0 && i !== filteredHistory.length - 1) return null;
                const x = 40 + (i * (360 - 2 * 40)) / (filteredHistory.length - 1 || 1);
                const d = new Date(item.date);
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yy = String(d.getFullYear()).slice(-2);
                const label = `${dd}.${mm}.${yy}`;
                return (
                  <text key={item.date} x={x} y={220} textAnchor="middle" fontSize="11" fill="#666">
                    {label}
                  </text>
                );
              })}
              {/* Line for close price */}
              {filteredHistory.length > 1 &&
                (() => {
                  const prices = filteredHistory.map((h) => h.close);
                  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                  const maxPrice = prices.length > 0 ? Math.max(...prices) : 1;
                  return (
                    <path
                      d={filteredHistory
                        .map((item, i) => {
                          const x = 40 + (i * (360 - 2 * 40)) / (filteredHistory.length - 1 || 1);
                          const y = 220 - 40 - ((item.close - minPrice) / (maxPrice - minPrice || 1)) * (220 - 2 * 40);
                          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#1976d2"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })()}
              {/* Data points */}
              {filteredHistory.map((item, i) => {
                const prices = filteredHistory.map((h) => h.close);
                const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                const maxPrice = prices.length > 0 ? Math.max(...prices) : 1;
                const x = 40 + (i * (360 - 2 * 40)) / (filteredHistory.length - 1 || 1);
                const y = 220 - 40 - ((item.close - minPrice) / (maxPrice - minPrice || 1)) * (220 - 2 * 40);
                return (
                  <g key={item.date}>
                    <circle cx={x} cy={y} r="4" fill="#1976d2" stroke="#fff" strokeWidth="2">
                      <title>{`${new Date(item.date).toLocaleDateString()}: ${item.close.toFixed(2)}`}</title>
                    </circle>
                  </g>
                );
              })}
            </svg>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default TickerPriceHistoryInline;
