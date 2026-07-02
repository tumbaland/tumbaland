import React, { useEffect, useState } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import TickerHistoryTable from './TickerHistoryTable';
import {
  getTickerPriceHistory,
  TickerPriceHistory,
  deleteTickerPriceHistory,
  fetchAllTickerPriceHistory
} from '../services/tickerPriceHistoryService';
import ConfirmationModal from './ConfirmationModal';

interface TickerHistoryModalProps {
  open: boolean;
  onClose: () => void;
  ticker: string;
}

const TickerHistoryModal: React.FC<TickerHistoryModalProps> = ({ open, onClose, ticker }) => {
  const [history, setHistory] = useState<TickerPriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [pendingStartDate, setPendingStartDate] = useState<string>('');
  const [pendingEndDate, setPendingEndDate] = useState<string>('');
  const [quickRange, setQuickRange] = useState<string>('1m');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Responsive container width
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setContainerWidth(Math.max(320, width));
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);

  // Set default date range to last 1 month on open
  useEffect(() => {
    if (open) {
      setQuickRange('1m');
      const now = new Date();
      const end = now.toISOString().slice(0, 10);
      const prevMonth = new Date(now);
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const start = prevMonth.toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
      setPendingStartDate(start);
      setPendingEndDate(end);
    }
  }, [open]);

  // Handle quick range selection
  const handleQuickRange = (value: string) => {
    setQuickRange(value);
    const now = new Date();
    let start: string;
    let end = now.toISOString().slice(0, 10);
    switch (value) {
      case '1m': {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        start = d.toISOString().slice(0, 10);
        break;
      }
      case '3m': {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 3);
        start = d.toISOString().slice(0, 10);
        break;
      }
      case '1y': {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 1);
        start = d.toISOString().slice(0, 10);
        break;
      }
      case '3y': {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 3);
        start = d.toISOString().slice(0, 10);
        break;
      }
      case '5y': {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 5);
        start = d.toISOString().slice(0, 10);
        break;
      }
      case 'all':
      default: {
        // Set to earliest available date in history, or fallback to 10 years ago
        let earliest = '';
        if (history.length > 0) {
          earliest = history.reduce((min, h) => (h.date < min ? h.date : min), history[0].date);
        } else {
          const d = new Date(now);
          d.setFullYear(d.getFullYear() - 10);
          earliest = d.toISOString().slice(0, 10);
        }
        start = earliest;
        break;
      }
    }
    setStartDate(start);
    setEndDate(end);
    setPendingStartDate(start);
    setPendingEndDate(end);
  };

  useEffect(() => {
    if (open && ticker) {
      setLoading(true);
      getTickerPriceHistory(ticker)
        .then((data) => setHistory(data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())))
        .catch(() => setError('Failed to load history'))
        .finally(() => setLoading(false));
    }
  }, [open, ticker]);

  // Only closing prices, filtered by date and ticker
  const filteredHistory = history
    .filter((h) => h.ticker === ticker)
    .filter((h) => {
      const d = new Date(h.date).toISOString().slice(0, 10);
      const afterStart = !startDate || d >= startDate;
      const beforeEnd = !endDate || d <= endDate;
      return afterStart && beforeEnd;
    });

  // Downsample for chart if too many points
  function downsampleHistory(data: TickerPriceHistory[], maxPoints: number = 500): TickerPriceHistory[] {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    const result: TickerPriceHistory[] = [];
    for (let i = 0; i < data.length; i += step) {
      result.push(data[i]);
    }
    // Always include last point for completeness
    if (result[result.length - 1] !== data[data.length - 1]) {
      result.push(data[data.length - 1]);
    }
    return result;
  }

  const chartHistory = downsampleHistory(filteredHistory);

  // For statistics, always use the full filteredHistory
  const statsPrices = filteredHistory.map((h) => h.price);
  const minPrice = statsPrices.length > 0 ? Math.min(...statsPrices) : 0;
  const maxPrice = statsPrices.length > 0 ? Math.max(...statsPrices) : 1;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider'
          }
        }
      }}
    >
      <DialogTitle sx={{ fontSize: { xs: 18, sm: 22 } }}>History for {ticker}</DialogTitle>
      <DialogContent sx={{ p: { xs: 1, sm: 3 } }}>
        {/* Date range pickers and apply button */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            mb: 2,
            alignItems: { xs: 'stretch', sm: 'center' },
            width: '100%',
            mt: 2
          }}
        >
          <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 180 }, flex: 1 }}>
            <InputLabel id="quick-range-label">Quick Range</InputLabel>
            <Select
              labelId="quick-range-label"
              value={quickRange}
              label="Quick Range"
              onChange={(e) => handleQuickRange(e.target.value)}
            >
              <MenuItem value="1m">Last 1 month</MenuItem>
              <MenuItem value="3m">Last 3 months</MenuItem>
              <MenuItem value="1y">Last 1 year</MenuItem>
              <MenuItem value="3y">Last 3 years</MenuItem>
              <MenuItem value="5y">Last 5 years</MenuItem>
              <MenuItem value="all">All time</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Start Date"
            type="date"
            size="small"
            value={pendingStartDate}
            onChange={(e) => setPendingStartDate(e.target.value)}
            sx={{ minWidth: { xs: 0, sm: 160 }, flex: 1 }}
          />
          <TextField
            label="End Date"
            type="date"
            size="small"
            value={pendingEndDate}
            onChange={(e) => setPendingEndDate(e.target.value)}
            sx={{ minWidth: { xs: 0, sm: 160 }, flex: 1 }}
          />
          <Button
            variant="contained"
            onClick={() => {
              setStartDate(pendingStartDate);
              setEndDate(pendingEndDate);
            }}
            sx={{ height: 40, width: { xs: '100%', sm: 'auto' }, mt: { xs: 1, sm: 0 } }}
          >
            Apply Filters
          </Button>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress size={48} color="primary" />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : filteredHistory.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 2 }}>
            <Typography sx={{
              color: "text.secondary"
            }}>No price history found for {ticker}.</Typography>
            <Button
              variant="contained"
              onClick={async () => {
                if (!ticker) return;
                setLoading(true);
                setError(null);
                try {
                  await fetchAllTickerPriceHistory(ticker);
                  const data = await getTickerPriceHistory(ticker);
                  setHistory(data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                } catch {
                  setError('Failed to fetch historical records');
                } finally {
                  setLoading(false);
                }
              }}
            >
              Fetch Historical Data
            </Button>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                maxWidth: 400,
                textAlign: 'center'
              }}>
              Fetches the last ~100 trading days from Alpha Vantage (free plan limit).
            </Typography>
          </Box>
        ) : (
          <>
            <Box ref={containerRef} sx={{ width: '100%', minHeight: 320, mt: 2, overflowX: 'auto' }}>
              {/* Chart Container (like PortfolioChart) */}
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
                    if (i % Math.ceil(filteredHistory.length / 7) !== 0 && i !== filteredHistory.length - 1)
                      return null;
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
                  {['1m', '3m'].includes(quickRange) &&
                    filteredHistory.map((item, i) => {
                      const x = 60 + (i * (containerWidth - 2 * 60)) / (filteredHistory.length - 1 || 1);
                      const y = 300 - 60 - ((item.price - minPrice) / (maxPrice - minPrice || 1)) * (300 - 2 * 60);
                      return (
                        <g key={item.date}>
                          <circle
                            cx={x}
                            cy={y}
                            r={window.innerWidth < 600 ? 3 : 5}
                            fill="#1976d2"
                            stroke="#fff"
                            strokeWidth="2"
                          >
                            <title>{`${new Date(item.date).toLocaleDateString()}: ${item.price.toFixed(2)}`}</title>
                          </circle>
                        </g>
                      );
                    })}
                </svg>
              </Box>
              {/* Summary */}
              <Box
                sx={{
                  mt: 2,
                  display: 'flex',
                  flexDirection: { xs: 'row', sm: 'row' },
                  justifyContent: 'space-around',
                  pt: 2,
                  borderTop: '1px solid #e0e0e0',
                  gap: { xs: 2, sm: 0 }
                }}
              >
                <Box sx={{ textAlign: 'center', mb: { xs: 1, sm: 0 } }}>
                  <Typography variant="h6" color="primary" sx={{ fontSize: { xs: 16, sm: 20 } }}>
                    {statsPrices.length}
                  </Typography>
                  <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>
                    Data Points
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', mb: { xs: 1, sm: 0 } }}>
                  <Typography variant="h6" color="primary" sx={{ fontSize: { xs: 16, sm: 20 } }}>
                    {maxPrice.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>
                    Max Close
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="primary" sx={{ fontSize: { xs: 16, sm: 20 } }}>
                    {minPrice.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>
                    Min Close
                  </Typography>
                </Box>
              </Box>
            </Box>
            {/* Compact price history table */}
            <TickerHistoryTable
              rows={filteredHistory}
              onDeleteRow={(row) => {
                // Try to find the _id from the original history array
                const match = history.find((h) => h.date === row.date && h.ticker === ticker);
                if (!match || !match._id) return;
                setPendingDeleteId(match._id);
                setConfirmOpen(true);
              }}
            />
            {/* Fetch All Records action at the bottom */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 3, mb: 1 }}>
              <Button
                variant="outlined"
                color="secondary"
                sx={{ mb: 1, fontWeight: 600, px: 3, py: 1.2, fontSize: 16 }}
                onClick={async () => {
                  if (!ticker) return;
                  setLoading(true);
                  setError(null);
                  try {
                    await fetchAllTickerPriceHistory(ticker);
                    // Refetch history after import
                    const data = await getTickerPriceHistory(ticker);
                    setHistory(data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                  } catch (err) {
                    setError('Failed to fetch all records');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Refresh Last ~100 Trading Days
              </Button>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  maxWidth: 520,
                  textAlign: 'center'
                }}>
                Fetches the last ~100 trading days from Alpha Vantage and updates existing records.
                Full history requires a premium plan.
              </Typography>
            </Box>
            <ConfirmationModal
              open={confirmOpen}
              title="Delete Price History Record"
              message="Are you sure you want to delete this price history record?"
              confirmText="Delete"
              cancelText="Cancel"
              severity="error"
              onConfirm={async () => {
                if (!pendingDeleteId) return;
                try {
                  await deleteTickerPriceHistory(pendingDeleteId);
                  setHistory((hist) => hist.filter((x) => x._id !== pendingDeleteId));
                } catch {
                  // Optionally show error
                } finally {
                  setConfirmOpen(false);
                  setPendingDeleteId(null);
                }
              }}
              onCancel={() => {
                setConfirmOpen(false);
                setPendingDeleteId(null);
              }}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: { xs: 1, sm: 2 } }}>
        <Button onClick={onClose} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TickerHistoryModal;
