import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { LineChart } from '@mui/x-charts';
import {
  MONTHS_PER_YEAR,
  PlanInputs,
  PlanRun,
  RandomResult,
  WhatIfRow,
  bufferMonthsOf,
  independenceTarget
} from '../../utils/lifePlan';
import { formatCurrency } from '../../utils/numberUtils';

export interface PlanScenario {
  key: 'low' | 'base' | 'high';
  label: string;
  returnPct: number;
  color: string;
  run: PlanRun;
}

interface PlanResultsProps {
  inputs: PlanInputs;
  scenarios: PlanScenario[];
  /** Random paths at the base return, or null while they are being worked out. */
  random: RandomResult | null;
  volatilityPct: number;
  whatIf: WhatIfRow[];
  /** The calendar year the plan starts in, for labelling the axis. */
  startYear: number;
  /** True when the current income has an end date, so the gap and the next income matter. */
  incomeEnds: boolean;
}

const compact = (value: number) =>
  Math.abs(value) >= 1_000_000
    ? `${+(value / 1_000_000).toFixed(1)}M`
    : Math.abs(value) >= 1_000
      ? `${Math.round(value / 1_000)}k`
      : `${Math.round(value)}`;

const percent = (share: number) => `${Math.round(share * 100)}%`;

const years = (months: number) => `${(months / MONTHS_PER_YEAR).toFixed(1)} years`;

const Stat: React.FC<{ label: string; value: string; detail?: string; color?: string }> = ({
  label,
  value,
  detail,
  color
}) => (
  <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
      {label}
    </Typography>
    <Typography variant="h6" sx={{ fontWeight: 700, color: color || 'text.primary', lineHeight: 1.25 }}>
      {value}
    </Typography>
    {detail && (
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
        {detail}
      </Typography>
    )}
  </Paper>
);

/**
 * What the plan says, in the order the questions come: where does it end up,
 * when can I stop depending on a salary, what happens in the gap, and what would
 * change it.
 */
const PlanResults: React.FC<PlanResultsProps> = ({
  inputs,
  scenarios,
  random,
  volatilityPct,
  whatIf,
  startYear,
  incomeEnds
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [showTable, setShowTable] = useState(false);

  const base = scenarios.find((s) => s.key === 'base')!;
  const run = base.run;
  const horizon = Math.round(inputs.years);
  const months = horizon * MONTHS_PER_YEAR;
  const target = independenceTarget(inputs);

  const end = (values: number[]) => values[values.length - 1];
  const reachedIn = run.independenceMonth;

  // How low the cash gets, which is what the buffer is for: measured through the
  // gap and the year after it, where the plan is drawing on it.
  const watchUntil = Math.min(
    months,
    Number.isFinite(inputs.incomeMonths) ? inputs.incomeMonths + inputs.gapMonths + 12 : 24
  );
  const lowestCash = Math.min(...run.cash.slice(0, watchUntil + 1));
  const bufferAtEnd = run.incomeEndsAt !== null ? run.cash[run.incomeEndsAt] : null;

  const yearLabels = Array.from({ length: horizon + 1 }, (_, y) => String(startYear + y));
  const yearly = (values: number[]) => Array.from({ length: horizon + 1 }, (_, y) => values[Math.min(values.length - 1, y * MONTHS_PER_YEAR)]);

  const bufferMonthsShown = Math.min(months, 36);
  const bufferLabels = Array.from({ length: bufferMonthsShown + 1 }, (_, m) => m);
  const bufferSeries = run.cash
    .slice(0, bufferMonthsShown + 1)
    .map((cash) => +bufferMonthsOf(cash, inputs.spending).toFixed(2));

  const sentence = (() => {
    const saving = incomeEnds
      ? inputs.takeHomeAfter - inputs.spending - inputs.extraYearly / MONTHS_PER_YEAR - Math.min(inputs.pensionContribution, inputs.takeHomeAfter)
      : inputs.takeHomeNow - inputs.spending - inputs.extraYearly / MONTHS_PER_YEAR - Math.min(inputs.pensionContribution, inputs.takeHomeNow);
    const savingText =
      saving >= 0
        ? `you put aside about ${formatCurrency(saving)} a month`
        : `you would draw about ${formatCurrency(-saving)} a month from your savings`;
    const when = incomeEnds ? 'Once the next income starts' : 'At your current take-home';
    const ending = reachedIn === null
      ? `the money you can reach does not cover ${formatCurrency(target)} within ${horizon} years`
      : reachedIn === 0
        ? 'what you can reach already covers the target'
        : `what you can reach covers the target in ${years(reachedIn)}`;
    return `${when}, ${savingText}. At ${base.returnPct}% after inflation, ${ending}.`;
  })();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
      {run.shortfallMonth !== null && (
        <Alert severity="error">
          In the base case the money you can reach runs out after {years(run.shortfallMonth)}. Raise the next
          income, cut spending or shorten the gap.
        </Alert>
      )}

      <Typography variant="body1">{sentence}</Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5
        }}
      >
        <Stat
          label={`In ${horizon} years, base case`}
          value={formatCurrency(end(run.accessible))}
          detail={`plus ${formatCurrency(end(run.pensions))} in pensions, locked`}
          color="primary.main"
        />
        {random && (
          <Stat
            label="Likely range at the end"
            value={`${formatCurrency(end(random.p10))} to ${formatCurrency(end(random.p90))}`}
            detail={`at ${base.returnPct}% with ${volatilityPct}% swings, 9 in 10 paths`}
          />
        )}
        <Stat
          label="Independence"
          value={reachedIn === null ? `Not within ${horizon} years` : reachedIn === 0 ? 'Already' : years(reachedIn)}
          detail={`target ${formatCurrency(target)} at ${inputs.withdrawalRatePct}% a year`}
          color={reachedIn === null ? 'text.secondary' : 'success.main'}
        />
        {random && (
          <Stat
            label="Chance of reaching it"
            value={percent(random.reachedTarget)}
            detail={`by year ${horizon}, over random paths`}
          />
        )}
        <Stat
          label="Lowest cash"
          value={`${bufferMonthsOf(lowestCash, inputs.spending).toFixed(1)} months`}
          detail={
            bufferAtEnd !== null
              ? `${bufferMonthsOf(bufferAtEnd, inputs.spending).toFixed(1)} months when the income stops`
              : 'of spending, at the lowest point'
          }
          color={lowestCash <= 0 ? 'error.main' : 'text.primary'}
        />
        {random && (
          <Stat
            label="Chance of running out"
            value={percent(random.ranOut)}
            detail="funds used up at some point"
            color={random.ranOut > 0.05 ? 'error.main' : 'text.primary'}
          />
        )}
      </Box>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Cash and funds you can reach
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            In today&apos;s money. Pensions are left out because they are locked until retirement age.
          </Typography>
          <LineChart
            xAxis={[{ data: yearLabels, scaleType: 'point', label: isMobile ? '' : 'Year' }]}
            yAxis={[{ valueFormatter: (v: number) => compact(v), width: isMobile ? 44 : 64 }]}
            series={[
              ...scenarios.map((s) => ({
                id: s.key,
                label: `${s.label} (${s.returnPct}%)`,
                data: yearly(s.run.accessible),
                color: s.color,
                showMark: false,
                curve: 'monotoneX' as const
              })),
              {
                id: 'target',
                label: 'Independence target',
                data: yearLabels.map(() => (Number.isFinite(target) ? target : null)),
                color: '#f59e0b',
                showMark: false
              }
            ]}
            height={isMobile ? 260 : 360}
            margin={isMobile ? { top: 8, right: 16, bottom: 8, left: 0 } : { top: 20, right: 24, bottom: 40, left: 8 }}
            grid={{ horizontal: true, vertical: false }}
          />
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Cash buffer, in months of spending
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Base case, the first {bufferMonthsShown} months from today.
            {run.incomeEndsAt !== null && run.incomeEndsAt <= bufferMonthsShown
              ? ` The current income stops in month ${run.incomeEndsAt}.`
              : ''}
          </Typography>
          <LineChart
            xAxis={[
              {
                data: bufferLabels,
                scaleType: 'point',
                label: isMobile ? '' : 'Months from today',
                tickLabelInterval: (_: unknown, index: number) => index % 6 === 0
              }
            ]}
            yAxis={[{ width: isMobile ? 36 : 48 }]}
            series={[
              { id: 'buffer', label: 'Months of cover', data: bufferSeries, color: '#22c55e', showMark: false, area: true }
            ]}
            height={isMobile ? 200 : 240}
            margin={isMobile ? { top: 8, right: 16, bottom: 8, left: 0 } : { top: 16, right: 24, bottom: 40, left: 8 }}
            grid={{ horizontal: true, vertical: false }}
          />
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            What if the {incomeEnds ? 'next income' : 'income'} were different
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Base case at {base.returnPct}%, everything else as entered.
          </Typography>
          <TableContainer>
            <Table size="small" aria-label="What if the income were different">
              <TableHead>
                <TableRow>
                  <TableCell>Take-home a month</TableCell>
                  <TableCell align="right">Saved a month</TableCell>
                  <TableCell align="right">In {horizon} years</TableCell>
                  <TableCell align="right">Independence</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {whatIf.map((row) => {
                  const current = Math.round(row.takeHomeAfter) === Math.round(incomeEnds ? inputs.takeHomeAfter : inputs.takeHomeNow);
                  return (
                    <TableRow key={row.takeHomeAfter} selected={current}>
                      <TableCell sx={{ fontWeight: current ? 700 : 400 }}>{formatCurrency(row.takeHomeAfter)}</TableCell>
                      <TableCell align="right" sx={{ color: row.monthlySaving < 0 ? 'error.main' : undefined }}>
                        {formatCurrency(row.monthlySaving)}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(row.accessibleAtEnd)}</TableCell>
                      <TableCell align="right">
                        {row.independenceYears === null ? 'Not within horizon' : `${row.independenceYears.toFixed(1)} years`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Box>
        <Button size="small" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Hide year by year' : 'Show year by year'}
        </Button>
        <Collapse in={showTable} unmountOnExit>
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mt: 1 }}>
            <Table size="small" aria-label="Year by year, base case">
              <TableHead>
                <TableRow>
                  <TableCell>Year</TableCell>
                  <TableCell align="right">Cash</TableCell>
                  <TableCell align="right">Funds</TableCell>
                  <TableCell align="right">Pensions</TableCell>
                  <TableCell align="right">Reachable</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {yearLabels.map((label, y) => {
                  const i = Math.min(run.cash.length - 1, y * MONTHS_PER_YEAR);
                  return (
                    <TableRow key={label}>
                      <TableCell>{label}</TableCell>
                      <TableCell align="right">{formatCurrency(run.cash[i])}</TableCell>
                      <TableCell align="right">{formatCurrency(run.funds[i])}</TableCell>
                      <TableCell align="right">{formatCurrency(run.pensions[i])}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatCurrency(run.accessible[i])}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Box>
    </Box>
  );
};

export default PlanResults;
