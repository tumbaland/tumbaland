import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  CircularProgress,
  Button,
  TableSortLabel,
  IconButton,
  Tooltip
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { getTickerPriceHistory, fetchTickerPriceHistory, deleteTickerPriceHistory } from '../services/tickerPriceHistoryService';
import ConfirmationModal from '../components/ConfirmationModal';

interface TickerPriceHistory {
  _id?: string;
  ticker: string;
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

const TickerPriceHistoryPage: React.FC = () => {
  const [history, setHistory] = useState<TickerPriceHistory[]>([]);
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState<keyof TickerPriceHistory>('date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchHistory = async (ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      await fetchTickerPriceHistory(ticker); // trigger backend fetch for this ticker
      const data = await getTickerPriceHistory(ticker);
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
      setError('Failed to load price history');
    } finally {
      setLoading(false);
    }
  };

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTicker(e.target.value.toUpperCase());
  };

  const handleTickerBlur = () => {
    if (ticker) fetchHistory(ticker);
  };

  const handleSort = (property: keyof TickerPriceHistory) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedHistory = React.useMemo(() => {
    return [...history].sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];
      if (orderBy === 'date') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }
      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }, [history, orderBy, order]);

  useEffect(() => {
    // On mount, fetch all history
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getTickerPriceHistory();
        setHistory(Array.isArray(data) ? data : []);
      } catch {
        setHistory([]);
        setError('Failed to load price history');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Helper to format date as DD.MM.YYYY
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const handleDelete = async (id: string) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    setLoading(true);
    try {
      await deleteTickerPriceHistory(pendingDeleteId);
      setHistory(hist => hist.filter(x => x._id !== pendingDeleteId));
    } catch (err) {
      setError('Failed to delete record');
    } finally {
      setLoading(false);
      setConfirmOpen(false);
      setPendingDeleteId(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Ticker Price History
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Ticker"
            value={ticker}
            onChange={handleTickerChange}
            onBlur={handleTickerBlur}
            variant="outlined"
            size="small"
            sx={{ minWidth: 120 }}
          />
          <Button
            variant="outlined"
            color="secondary"
            disabled={!ticker || loading}
            onClick={() => ticker && fetchHistory(ticker)}
          >
            Fetch Latest
          </Button>
        </Box>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <TableContainer component={Paper} sx={{ width: '100%' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'ticker'}
                    direction={orderBy === 'ticker' ? order : 'asc'}
                    onClick={() => handleSort('ticker')}
                  >
                    Ticker
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'date'}
                    direction={orderBy === 'date' ? order : 'desc'}
                    onClick={() => handleSort('date')}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'close'}
                    direction={orderBy === 'close' ? order : 'desc'}
                    onClick={() => handleSort('close')}
                  >
                    Close
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'open'}
                    direction={orderBy === 'open' ? order : 'desc'}
                    onClick={() => handleSort('open')}
                  >
                    Open
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'high'}
                    direction={orderBy === 'high' ? order : 'desc'}
                    onClick={() => handleSort('high')}
                  >
                    High
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'low'}
                    direction={orderBy === 'low' ? order : 'desc'}
                    onClick={() => handleSort('low')}
                  >
                    Low
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'volume'}
                    direction={orderBy === 'volume' ? order : 'desc'}
                    onClick={() => handleSort('volume')}
                  >
                    Volume
                  </TableSortLabel>
                </TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedHistory.map((h, idx) => (
                <TableRow key={h._id || h.date || idx}>
                  <TableCell>{h.ticker}</TableCell>
                  <TableCell>{formatDate(h.date)}</TableCell>
                  <TableCell>{h.close}</TableCell>
                  <TableCell>{h.open ?? ''}</TableCell>
                  <TableCell>{h.high ?? ''}</TableCell>
                  <TableCell>{h.low ?? ''}</TableCell>
                  <TableCell>{h.volume ?? ''}</TableCell>
                  <TableCell>
                    <Tooltip title="Delete">
                      <IconButton
                        color="error"
                        size="small"
                        disabled={loading}
                        onClick={() => handleDelete(h._id ?? '')}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <ConfirmationModal
        open={confirmOpen}
        title="Delete Price History Record"
        message="Are you sure you want to delete this price history record? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        severity="error"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
      />
    </Box>
  );
};

export default TickerPriceHistoryPage;
