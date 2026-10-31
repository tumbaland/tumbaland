import React from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import { ClosedPosition } from '../../services/holdingService';
import { formatCurrency, formatPrice } from '../../utils/numberUtils';

interface ClosedPositionsSectionProps {
  positions: ClosedPosition[];
}

const signColor = (v?: number) => (v === undefined || v === 0 ? 'text.secondary' : v > 0 ? 'success.main' : 'error.main');
const signed = (v: number, currency: string) => `${v > 0 ? '+' : ''}${formatCurrency(v, currency)}`;

/**
 * What the positions you sold out of earned.
 *
 * Selling the last unit removes a holding from the table above, and with it
 * the gain it realised and the dividends it paid. They are still part of what
 * investing has made, so they are kept here rather than disappearing.
 */
const ClosedPositionsSection: React.FC<ClosedPositionsSectionProps> = ({ positions }) => {
  if (positions.length === 0) return null;

  const currency = positions[0].baseCurrency || 'EUR';
  // A position with no exchange rate has no base-currency figures to add up.
  const counted = positions.filter((p) => !p.missingFxRate);
  const sum = (pick: (p: ClosedPosition) => number | undefined) =>
    counted.reduce((total, p) => total + (pick(p) ?? 0), 0);
  const totals = {
    realized: sum((p) => p.realizedGain),
    dividends: sum((p) => p.dividends),
    total: sum((p) => p.totalReturn)
  };

  const money = (p: ClosedPosition, value?: number) =>
    p.missingFxRate || value === undefined ? '—' : formatCurrency(value, currency);

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Sold positions
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Funds you held and sold out of, and what they made.
      </Typography>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <Table size="small" aria-label="Sold positions">
          <TableHead>
            <TableRow>
              <TableCell>Ticker</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Held</TableCell>
              <TableCell align="right">Bought ({currency})</TableCell>
              <TableCell align="right">Sold for ({currency})</TableCell>
              <TableCell align="right">Realized</TableCell>
              <TableCell align="right">Dividends</TableCell>
              <TableCell align="right">Total return</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.map((p) => (
              <TableRow key={p.ticker} hover>
                <TableCell sx={{ fontWeight: 600 }}>{p.ticker}</TableCell>
                <TableCell>{p.displayName || '—'}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {p.firstTradeDate} → {p.closedDate}
                </TableCell>
                <TableCell align="right">{money(p, p.bought)}</TableCell>
                <TableCell align="right">{money(p, p.proceeds)}</TableCell>
                <TableCell align="right" sx={{ color: signColor(p.realizedGain) }}>
                  {p.missingFxRate || p.realizedGain === undefined ? (
                    p.missingFxRate ? (
                      <Tooltip title={`No ${p.currency}→${p.baseCurrency} exchange rate yet`}>
                        <span>—</span>
                      </Tooltip>
                    ) : '—'
                  ) : signed(p.realizedGain, currency)}
                </TableCell>
                <TableCell align="right" sx={{ color: p.dividends ? 'success.main' : undefined }}>
                  {p.dividends ? formatPrice(p.dividends, currency) : '—'}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: signColor(p.totalReturn) }}>
                  {p.missingFxRate || p.totalReturn === undefined ? '—' : signed(p.totalReturn, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} sx={{ fontWeight: 700 }}>Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: signColor(totals.realized) }}>
                {signed(totals.realized, currency)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: totals.dividends ? 'success.main' : undefined }}>
                {totals.dividends ? formatPrice(totals.dividends, currency) : '—'}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: signColor(totals.total) }}>
                {signed(totals.total, currency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ClosedPositionsSection;
