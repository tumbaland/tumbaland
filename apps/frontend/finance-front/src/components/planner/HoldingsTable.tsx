import React from 'react';
import {
  Box,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Typography,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Holding } from '../../services/holdingService';

export interface HoldingStat extends Omit<Holding, 'latestPrice' | 'currentValue'> {
  latestPrice: number | null;
  returnPct: number | null;
  currentValue: number | null;
}

interface HoldingsTableProps {
  holdings: HoldingStat[];
  nameByTicker: Record<string, string>;
  totalValue: number;
}

const returnColor = (returnPct: number | null) =>
  returnPct == null ? 'text.secondary' : returnPct >= 0 ? 'success.main' : 'error.main';

const HoldingsTable: React.FC<HoldingsTableProps> = ({ holdings, nameByTicker, totalValue }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <>
      <Typography variant="h6" sx={{ mb: 1 }}>Current Holdings</Typography>
      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
          {holdings.map((h) => (
            <Paper key={h.ticker} elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{h.ticker}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {nameByTicker[h.ticker] ?? '—'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {h.currentValue != null ? h.currentValue.toFixed(2) : '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: returnColor(h.returnPct) }}>
                    {h.returnPct != null ? `${h.returnPct >= 0 ? '+' : ''}${h.returnPct.toFixed(2)}%` : '—'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mt: 1 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Qty</Typography>
                  <Typography variant="body2">{h.quantity}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Avg Buy</Typography>
                  <Typography variant="body2">{h.avgBuyPrice.toFixed(2)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Weight</Typography>
                  <Typography variant="body2">
                    {h.currentValue != null && totalValue > 0
                      ? `${((h.currentValue / totalValue) * 100).toFixed(1)}%`
                      : '—'}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 600 } }}>
                <TableCell>Ticker</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Avg Buy</TableCell>
                <TableCell align="right">Current Price</TableCell>
                <TableCell align="right">Return</TableCell>
                <TableCell align="right">Value</TableCell>
                <TableCell align="right">Weight</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {holdings.map(h => (
                <TableRow key={h.ticker} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{h.ticker}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                    {nameByTicker[h.ticker] ?? '—'}
                  </TableCell>
                  <TableCell align="right">{h.quantity}</TableCell>
                  <TableCell align="right">{h.avgBuyPrice.toFixed(2)}</TableCell>
                  <TableCell align="right">{h.latestPrice != null ? h.latestPrice.toFixed(2) : '—'}</TableCell>
                  <TableCell align="right" sx={{ color: returnColor(h.returnPct), fontWeight: 600 }}>
                    {h.returnPct != null ? `${h.returnPct >= 0 ? '+' : ''}${h.returnPct.toFixed(2)}%` : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {h.currentValue != null ? h.currentValue.toFixed(2) : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {h.currentValue != null && totalValue > 0
                      ? `${((h.currentValue / totalValue) * 100).toFixed(1)}%`
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
};

export default HoldingsTable;
