import React from 'react';
import {
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Typography
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

const HoldingsTable: React.FC<HoldingsTableProps> = ({ holdings, nameByTicker, totalValue }) => (
  <>
    <Typography variant="h6" sx={{ mb: 1 }}>Current Holdings</Typography>
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
              <TableCell
                align="right"
                sx={{
                  color: h.returnPct == null ? 'text.secondary' : h.returnPct >= 0 ? 'success.main' : 'error.main',
                  fontWeight: 600
                }}
              >
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
  </>
);

export default HoldingsTable;
