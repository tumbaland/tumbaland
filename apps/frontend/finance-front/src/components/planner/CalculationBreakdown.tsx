import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { FrontierSim, TRADING_DAYS } from '../../utils/frontierSim';
import { ANCHOR_DAYS, LONG_RUN_RETURN_PCT, shrinkExpectedReturn } from '../../utils/growthProjection';

/**
 * The frontier's arithmetic, written out with this portfolio's own numbers in it.
 *
 * A single "34.0% expected return" is unfalsifiable by the person reading it —
 * they cannot tell whether it means "this is what you will earn" or "this is
 * five good months, annualized". Every figure here is therefore shown as the
 * formula that produced it with the values substituted, so the reader can check
 * the step they doubt rather than trusting or dismissing the whole thing.
 *
 * Collapsed by default: the answer stays the headline, the derivation is there
 * for whoever wants it.
 */

interface CalculationBreakdownProps {
  sim: FrontierSim;
  nameByTicker: Record<string, string>;
}

const pct = (v: number, digits = 1) => `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(digits)}%`;
const pp = (v: number, digits = 1) => `${Math.abs(v).toFixed(digits)}pp`;

/** Formula lines are monospace so the substituted numbers line up under each other. */
const Formula: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    component="pre"
    sx={{
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: { xs: '0.72rem', sm: '0.8rem' },
      lineHeight: 1.7,
      m: 0,
      p: 1.5,
      overflowX: 'auto',
      bgcolor: 'action.hover',
      borderRadius: 1,
      whiteSpace: 'pre'
    }}
  >
    {children}
  </Box>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const CalculationBreakdown: React.FC<CalculationBreakdownProps> = ({ sim, nameByTicker }) => {
  const { basis, periodsPerYear, window, assets, correlations, current, riskFreeRatePct } = sim.breakdown;

  // Everything on this panel is stated in the units it was estimated in, so the
  // reader can check the multiplication rather than take the annualized number
  // on trust.
  const period = basis === 'weekly' ? 'weekly' : 'daily';
  const perPeriod = basis === 'weekly' ? 'week' : 'day';

  // Everything below describes the portfolio actually held. Without quantities
  // there are no weights, so there is no portfolio arithmetic to show — only
  // the per-holding inputs.
  const sampleDays = sim.breakdown.equivalentTradingDays;
  const shrunk = current ? shrinkExpectedReturn(current.arithmeticPct, sampleDays) : null;
  const historyWeight = sampleDays / (sampleDays + ANCHOR_DAYS);

  return (
    <Accordion disableGutters sx={{ mt: 3, borderRadius: 2, '&:before': { display: 'none' } }} elevation={0} variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 600 }}>How these numbers are calculated</Typography>
      </AccordionSummary>

      <AccordionDetails>
        <Section title="1. The sample everything is estimated from">
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            Only the dates on which <em>every</em> holding traded can be used, because a covariance
            needs both assets observed on the same date. That overlap is the entire evidence base for
            the numbers below — no figure here knows anything about the market outside it.
            {basis === 'weekly' && (
              <>
                {' '}
                <b>Estimated from weekly closes</b>, which reach far further back than the daily
                series: an estimate is worth more for having seen several years than for having
                sampled one of them finely.
              </>
            )}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`${window.from} → ${window.to}`} />
            <Chip size="small" label={`${window.observations} ${period} returns`} />
            <Chip size="small" label={`${window.spanDays} calendar days`} />
            <Chip
              size="small"
              color={window.spanDays < 365 ? 'warning' : 'default'}
              label={`${((window.spanDays / 365) * 100).toFixed(0)}% of a year`}
            />
          </Box>
        </Section>

        <Section title="2. What each holding did, and what it contributed">
          <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Holding</TableCell>
                  <TableCell align="right">Weight&nbsp;w</TableCell>
                  <TableCell align="right">Over the window</TableCell>
                  <TableCell align="right">Mean per {perPeriod}&nbsp;μ</TableCell>
                  <TableCell align="right">μ × {periodsPerYear}</TableCell>
                  <TableCell align="right">Volatility</TableCell>
                  <TableCell align="right">w × μ × {periodsPerYear}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assets.map(asset => (
                  <TableRow key={asset.ticker} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{asset.ticker}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {nameByTicker[asset.ticker] ?? ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{asset.weight === null ? '—' : pct(asset.weight * 100)}</TableCell>
                    <TableCell align="right">{pct(asset.windowReturnPct)}</TableCell>
                    <TableCell align="right">{(asset.meanPeriod * 100).toFixed(3)}%</TableCell>
                    <TableCell align="right">{pct(asset.annualizedPct)}</TableCell>
                    <TableCell align="right">{pct(asset.volPct)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {asset.contributionPct === null ? '—' : pct(asset.contributionPct)}
                    </TableCell>
                  </TableRow>
                ))}
                {current && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ fontWeight: 700 }}>
                      Portfolio — the sum of the last column
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{pct(current.arithmeticPct)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            Weights are each holding&apos;s share of portfolio value on the last shared date. &quot;Over
            the window&quot; is the plain first-to-last price change; μ × {periodsPerYear} annualizes the{' '}
            <em>average</em> {perPeriod} instead, which is why the two differ.
          </Typography>
        </Section>

        {current && (
          <>
            <Section title="3. From those inputs to the headline figures">
              <Formula>
                {[
                  `expected return  = Σ wᵢ·μᵢ × ${periodsPerYear}`.padEnd(42) + `= ${pct(current.arithmeticPct)}`,
                  `volatility       = √(w′Σw × ${periodsPerYear})`.padEnd(42) + `= ${pct(current.volPct)}`,
                  `Sharpe           = (${current.arithmeticPct.toFixed(1)} − ${riskFreeRatePct.toFixed(1)}) ÷ ${current.volPct.toFixed(1)}`.padEnd(42) +
                    `= ${current.sharpe.toFixed(2)}`
                ].join('\n')}
              </Formula>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
                Σ is the covariance matrix of {period} returns: <code>w′Σw</code> is the
                portfolio&apos;s {perPeriod}ly variance, which is smaller than the weighted average of the individual
                variances whenever the holdings do not move together. That reduction is the only
                thing diversification buys, and it is what the frontier is a picture of.
              </Typography>
            </Section>

            <Section title="4. Average year vs. compounded year">
              <Formula>
                {[
                  `variance drag    = σ² ÷ 2               = ${pp(current.varianceDragPct)}`,
                  `compounded       = ${current.arithmeticPct.toFixed(1)}% − ${current.varianceDragPct.toFixed(1)}pp`.padEnd(42) +
                    `= ${pct(current.geometricPct)}`
                ].join('\n')}
              </Formula>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
                The average of the yearly returns is not what a euro actually grows at — a −50%
                followed by a +50% averages zero and leaves you down 25%. The frontier is drawn on the
                arithmetic figure because that is what mean-variance optimization is defined on; the
                compounded figure is the one to hold against real growth.
              </Typography>
            </Section>

            <Section title="5. How much to trust it">
              <Formula>
                {[
                  `standard error   = σ ÷ √n × ${periodsPerYear}`.padEnd(42) + `= ± ${pp(current.standardErrorPct)}`,
                  `95% interval     = ${current.arithmeticPct.toFixed(1)}% ± 1.96 × ${current.standardErrorPct.toFixed(1)}pp`,
                  `                 = ${pct(current.ci95[0])} … ${pct(current.ci95[1])}`
                ].join('\n')}
              </Formula>
              <Alert severity={current.ci95[0] < 0 ? 'warning' : 'info'} sx={{ mt: 1.5 }}>
                {current.ci95[0] < 0 ? (
                  <>
                    With {window.observations} observations the interval still includes a loss, so{' '}
                    {pct(current.arithmeticPct)} cannot be read as a forecast — it describes this
                    window, and a different window would move it a long way. The interval narrows with
                    the square root of the sample: four times the history halves it.
                  </>
                ) : (
                  <>
                    Estimated from {window.observations} observations. The interval narrows with the
                    square root of the sample, so four times the history halves it.
                  </>
                )}
              </Alert>
            </Section>

            <Section title="6. What the projection actually uses">
              <Formula>
                {[
                  `sample           = ${window.observations} ${period} × ${(TRADING_DAYS / periodsPerYear).toFixed(0)}`.padEnd(42) +
                    `= ${sampleDays} trading days`,
                  `history weight   = n ÷ (n + ${ANCHOR_DAYS})`.padEnd(42) + `= ${historyWeight.toFixed(2)}`,
                  `projection input = ${historyWeight.toFixed(2)} × ${current.arithmeticPct.toFixed(1)}% + ${(1 - historyWeight).toFixed(2)} × ${LONG_RUN_RETURN_PCT}%`,
                  `                 = ${pct(shrunk ?? 0)}`
                ].join('\n')}
              </Formula>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
                The Projection tab does not compound the figure above. It blends it toward a {LONG_RUN_RETURN_PCT}%
                long-run equity anchor in proportion to how much history stands behind it — {ANCHOR_DAYS}{' '}
                trading days (about three years) earns history equal weight. On this sample the
                historical estimate carries {(historyWeight * 100).toFixed(0)}% of the answer
                {basis === 'weekly' && ' — weekly closes are converted to trading-day equivalents first, so a long weekly history is not discounted for being sampled coarsely'}.
              </Typography>
            </Section>
          </>
        )}

        <Section title={`${current ? '7' : '3'}. How the holdings move together`}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            Correlations of daily returns over the same window. Values near 1 mean the pair adds risk
            without adding diversification — the frontier can only improve on a portfolio to the
            extent these are below 1.
          </Typography>
          <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  {sim.tickers.map(t => (
                    <TableCell key={t} align="right">{t}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sim.tickers.map((row, i) => (
                  <TableRow key={row} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{row}</TableCell>
                    {sim.tickers.map((col, j) => (
                      <TableCell
                        key={col}
                        align="right"
                        sx={{
                          color: i === j ? 'text.disabled' : correlations[i][j] > 0.9 ? 'warning.main' : 'text.primary',
                          fontWeight: i !== j && correlations[i][j] > 0.9 ? 600 : 400
                        }}
                      >
                        {correlations[i][j].toFixed(2)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Section>
      </AccordionDetails>
    </Accordion>
  );
};

export default CalculationBreakdown;
