import React from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import { FrontierSim, SimPoint } from '../../utils/frontierSim';
import { effectiveHoldings, maxDrawdownPct, portfolioReturns, riskContributions, worstWindowPct } from '../../utils/optimizer';

interface FrontierInsightsProps {
  sim: FrontierSim;
  targetPortfolio: SimPoint | null;
  nameByTicker: Record<string, string>;
}

const pct = (v: number, digits = 1) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}%`;

/** A holding that carries clearly more of the risk than it does of the money. */
const RISKY_RATIO = 1.3;

const cardSx = { border: '1px solid', borderColor: 'divider', borderRadius: 2 };

/**
 * Two things the weights alone do not show: where the risk actually sits, and
 * how each portfolio would have fared in the worst stretch of the window.
 */
const FrontierInsights: React.FC<FrontierInsightsProps> = ({ sim, targetPortfolio, nameByTicker }) => {
  const { cov, returnSeries, periodsPerYear } = sim.model;
  const columns: Array<{ label: string; weights: number[] }> = [
    ...(sim.current ? [{ label: 'You', weights: sim.current.weights }] : []),
    ...(targetPortfolio ? [{ label: 'Target', weights: targetPortfolio.weights }] : [])
  ];

  const shares = columns.map((c) => riskContributions(c.weights, cov));

  // A year of periods, so the worst-year figure means the same on either basis.
  const rows: Array<{ label: string; weights: number[] }> = [
    ...(sim.current ? [{ label: 'You', weights: sim.current.weights }] : []),
    ...(targetPortfolio ? [{ label: 'Target', weights: targetPortfolio.weights }] : []),
    { label: 'Max Sharpe', weights: sim.maxSharpe.weights },
    { label: 'Min risk', weights: sim.minVol.weights }
  ];
  const lookBack = rows.map((row) => {
    const returns = portfolioReturns(row.weights, returnSeries);
    return {
      label: row.label,
      deepestFall: maxDrawdownPct(returns),
      worstYear: worstWindowPct(returns, periodsPerYear)
    };
  });

  const { window } = sim.breakdown;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2, mb: 3 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Where the risk comes from
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          A holding can be a third of the money and half the risk.
          {columns.length > 0 && (
            <>
              {' '}
              Behaves like {columns.map((c) => `${effectiveHoldings(c.weights).toFixed(1)} equal holdings (${c.label.toLowerCase()})`).join(', ')}.
            </>
          )}
        </Typography>
        <TableContainer component={Paper} elevation={0} sx={cardSx}>
          <Table size="small" aria-label="Where the risk comes from">
            <TableHead>
              <TableRow>
                <TableCell>Holding</TableCell>
                {columns.map((c) => (
                  <React.Fragment key={c.label}>
                    <TableCell align="right">{c.label} money</TableCell>
                    <TableCell align="right">{c.label} risk</TableCell>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sim.tickers.map((ticker, i) => (
                <TableRow key={ticker} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    <Tooltip title={nameByTicker[ticker] ?? ticker} placement="right">
                      <span>{ticker}</span>
                    </Tooltip>
                  </TableCell>
                  {columns.map((c, k) => {
                    const money = c.weights[i];
                    const risk = shares[k][i];
                    const heavy = money > 0.005 && risk / money > RISKY_RATIO;
                    return (
                      <React.Fragment key={c.label}>
                        <TableCell align="right">{pct(money * 100)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: heavy ? 700 : 400, color: heavy ? 'warning.main' : undefined }}>
                          {pct(risk * 100)}
                        </TableCell>
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          What it would have been through
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Each mix held at fixed weights over {window.from} to {window.to}. The past is a guide to what can happen, not a
          limit on it.
        </Typography>
        <TableContainer component={Paper} elevation={0} sx={cardSx}>
          <Table size="small" aria-label="What it would have been through">
            <TableHead>
              <TableRow>
                <TableCell>Portfolio</TableCell>
                <TableCell align="right">Deepest fall</TableCell>
                <TableCell align="right">Worst 12 months</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lookBack.map((row) => (
                <TableRow key={row.label} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{row.label}</TableCell>
                  <TableCell align="right" sx={{ color: row.deepestFall < -15 ? 'error.main' : undefined }}>
                    {pct(row.deepestFall)}
                  </TableCell>
                  <TableCell align="right">
                    {row.worstYear === null ? (
                      <Tooltip title="Less than a year of history">
                        <span>needs a year</span>
                      </Tooltip>
                    ) : (
                      pct(row.worstYear)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default FrontierInsights;
