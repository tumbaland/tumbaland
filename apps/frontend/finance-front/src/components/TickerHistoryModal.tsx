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
import { TickerPriceChart } from './TickerPriceChart';
import { TickerPriceSummary } from './TickerPriceSummary';
import {
  getTickerPriceHistory,
  TickerPriceHistory,
  deleteTickerPriceHistory,
  fetchAllTickerPriceHistory
} from '../services/tickerPriceHistoryService';
import { localDayKey } from '../utils/dates';
import { downsample } from '../utils/downsample';
import { quickRangeStart } from '../utils/quickRange';
import { ConfirmationModal } from '@tumbaland/frontend-core';

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

  // Handle quick range selection
  const handleQuickRange = (range: string) => {
    const earliest =
      history.length > 0 ? history.reduce((min, h) => (h.date < min ? h.date : min), history[0].date) : undefined;
    const start = quickRangeStart(range, new Date(), earliest);
    const end = localDayKey(new Date());
    setQuickRange(range);
    setStartDate(start);
    setEndDate(end);
    setPendingStartDate(start);
    setPendingEndDate(end);
  };

  // Default date range is the last month, every time the dialog opens
  useEffect(() => {
    if (open) handleQuickRange('1m');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open; "1m" needs no history
  }, [open]);

  useEffect(() => {
    if (open && ticker) {
      setLoading(true);
      getTickerPriceHistory({ ticker })
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
  const chartHistory = downsample(filteredHistory);

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
                  const data = await getTickerPriceHistory({ ticker });
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
              <TickerPriceChart
                width={containerWidth}
                prices={filteredHistory}
                linePoints={chartHistory}
                minPrice={minPrice}
                maxPrice={maxPrice}
                showDots={['1m', '3m'].includes(quickRange)}
              />
              <TickerPriceSummary count={statsPrices.length} maxPrice={maxPrice} minPrice={minPrice} />
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
                    const data = await getTickerPriceHistory({ ticker });
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
