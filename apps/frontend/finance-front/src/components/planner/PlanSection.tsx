import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, TextField, Typography } from '@mui/material';
import { useTenantFilter } from '@tumbaland/frontend-core';
import { useDashboard } from '../../hooks/useDashboard';
import { usePersistedState } from '../../hooks/usePersistedState';
import { DashboardData } from '../../services/dashboardService';
import { formatCurrency, parseNumericInput } from '../../utils/numberUtils';
import {
  PlanInputs,
  RandomResult,
  monthsThrough,
  runRandom,
  runSteady,
  whatIfTakeHome
} from '../../utils/lifePlan';
import PlanResults, { PlanScenario } from './PlanResults';

const KEY = 'finance-plan-';
const RANDOM_PATHS = 500;
const DEBOUNCE_MS = 250;
const MAX_YEARS = 40;

const fieldSx = {
  '& .MuiInputBase-input': { fontSize: '0.85rem' },
  '& .MuiInputLabel-root': { fontSize: '0.85rem' }
};

/** A number from a text field, or the fallback while it is empty or half typed. */
const num = (text: string, fallback: number) => {
  const value = parseNumericInput(text);
  return Number.isFinite(value) ? value : fallback;
};

/**
 * What the dashboard already knows, as the starting point. Every field the plan
 * takes can be overridden; an empty one follows the data.
 */
export function startingPoint(data: DashboardData | undefined) {
  const trailing = data?.cashflow?.trailing;
  const months = trailing && trailing.months > 0 ? trailing.months : 0;
  const pensions = (data?.allocation ?? [])
    .filter((a) => a.liquidity === 'locked' && /pension/i.test(a.name))
    .reduce((sum, a) => sum + a.value, 0);

  return {
    cash: Math.round(data?.safety?.cash ?? 0),
    funds: Math.round(data?.safety?.market ?? 0),
    pensions: Math.round(pensions),
    spending: months ? Math.round(trailing!.consumption / months) : 0,
    takeHome: months ? Math.round((trailing!.incomeBy?.salary ?? trailing!.income) / months) : 0
  };
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shown when the field is empty and follows the data. */
  auto?: number | string;
  helper?: string;
  type?: string;
  step?: number;
  min?: number;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, auto, helper, type = 'number', step, min = 0 }) => (
  <TextField
    label={label}
    type={type}
    size="small"
    fullWidth
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={auto !== undefined ? String(auto) : undefined}
    helperText={helper ?? (auto !== undefined && value === '' ? 'From your data. Type to change it.' : undefined)}
    sx={fieldSx}
    slotProps={{ inputLabel: { shrink: true }, htmlInput: { min, step } }}
  />
);

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

/**
 * The plan: what you have, what comes in and goes out, when the income changes,
 * and what that means for the next years.
 *
 * Starts from the real figures on the dashboard so there is nothing to type to
 * get a first answer; the rest is what only you know, such as when the income
 * ends, and is remembered between visits.
 */
const PlanSection: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const { data, isLoading } = useDashboard(tenantGroupId);
  const auto = useMemo(() => startingPoint(data), [data]);

  // Text inputs stay strings so a field can be cleared while typing. Empty means
  // "follow the data" for the ones that have a figure to follow.
  const [cash, setCash] = usePersistedState(`${KEY}cash`, '');
  const [funds, setFunds] = usePersistedState(`${KEY}funds`, '');
  const [pensions, setPensions] = usePersistedState(`${KEY}pensions`, '');
  const [spending, setSpending] = usePersistedState(`${KEY}spending`, '');
  const [extraYearly, setExtraYearly] = usePersistedState(`${KEY}extra-yearly`, '0');
  const [takeHomeNow, setTakeHomeNow] = usePersistedState(`${KEY}take-home-now`, '');
  const [incomeEnds, setIncomeEnds] = usePersistedState(`${KEY}income-ends`, '');
  const [gapMonths, setGapMonths] = usePersistedState(`${KEY}gap-months`, '3');
  const [takeHomeAfter, setTakeHomeAfter] = usePersistedState(`${KEY}take-home-after`, '');
  const [pensionContribution, setPensionContribution] = usePersistedState(`${KEY}pension`, '0');
  const [bufferMonths, setBufferMonths] = usePersistedState(`${KEY}buffer-months`, '12');
  const [years, setYears] = usePersistedState(`${KEY}years`, '10');
  const [withdrawal, setWithdrawal] = usePersistedState(`${KEY}withdrawal`, '3.5');
  const [low, setLow] = usePersistedState(`${KEY}return-low`, '2');
  const [mid, setMid] = usePersistedState(`${KEY}return-base`, '4');
  const [high, setHigh] = usePersistedState(`${KEY}return-high`, '6');
  const [volatility, setVolatility] = usePersistedState(`${KEY}volatility`, '15');

  const today = useMemo(() => new Date(), []);
  const endDate = incomeEnds ? new Date(`${incomeEnds}T12:00:00`) : null;
  const endsValid = endDate !== null && !isNaN(endDate.getTime());

  const takeNow = num(takeHomeNow, auto.takeHome);
  const inputs: PlanInputs = useMemo(
    () => ({
      cash: num(cash, auto.cash),
      funds: num(funds, auto.funds),
      pensions: num(pensions, auto.pensions),
      spending: num(spending, auto.spending),
      extraYearly: num(extraYearly, 0),
      takeHomeNow: takeNow,
      incomeMonths: endsValid ? monthsThrough(today, endDate!) : Infinity,
      gapMonths: Math.max(0, Math.round(num(gapMonths, 0))),
      takeHomeAfter: num(takeHomeAfter, takeNow),
      pensionContribution: num(pensionContribution, 0),
      bufferMonths: num(bufferMonths, 12),
      fillBufferFirst: true,
      years: Math.min(MAX_YEARS, Math.max(1, Math.round(num(years, 10)))),
      withdrawalRatePct: num(withdrawal, 3.5)
    }),
    [
      cash, funds, pensions, spending, extraYearly, takeNow, endsValid, incomeEnds, gapMonths,
      takeHomeAfter, pensionContribution, bufferMonths, years, withdrawal, auto, today
    ]
  );

  const returns = { low: num(low, 2), base: num(mid, 4), high: num(high, 6) };
  const vol = Math.max(0, num(volatility, 15));

  const scenarios: PlanScenario[] = useMemo(
    () => [
      { key: 'low', label: 'Cautious', returnPct: returns.low, color: '#ef4444', run: runSteady(inputs, returns.low) },
      { key: 'base', label: 'Base', returnPct: returns.base, color: '#667eea', run: runSteady(inputs, returns.base) },
      { key: 'high', label: 'Optimistic', returnPct: returns.high, color: '#22c55e', run: runSteady(inputs, returns.high) }
    ],
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [inputs, returns.low, returns.base, returns.high]
  );

  const centre = Math.round(endsValid ? inputs.takeHomeAfter : inputs.takeHomeNow);
  const levels = useMemo(() => {
    const steps = [-1000, -500, 0, 500, 1000, 1500, 2000];
    return [...new Set(steps.map((s) => Math.max(0, centre + s)))].sort((a, b) => a - b);
  }, [centre]);
  const whatIf = useMemo(
    () => whatIfTakeHome(inputs, returns.base, levels),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [inputs, returns.base, levels]
  );

  // The random paths are the heavy part, so they wait for typing to stop.
  const [random, setRandom] = useState<RandomResult | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setRandom(runRandom(inputs, returns.base, vol, RANDOM_PATHS)), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, returns.base, vol]);

  const reset = () => {
    [setCash, setFunds, setPensions, setSpending, setTakeHomeNow, setIncomeEnds, setTakeHomeAfter].forEach((set) => set(''));
    setExtraYearly('0');
    setGapMonths('3');
    setPensionContribution('0');
    setBufferMonths('12');
    setYears('10');
    setWithdrawal('3.5');
    setLow('2');
    setMid('4');
    setHigh('6');
    setVolatility('15');
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const noData = !data?.safety && inputs.cash + inputs.funds + inputs.pensions === 0;

  return (
    <Box>
      {noData && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nothing to start from yet. Add a net worth check-in and mark each asset class as cash, sellable or
          locked, or type your balances below.
        </Alert>
      )}
      {data?.safety && data.safety.cash + data.safety.market === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Mark your asset classes as cash, sellable or locked (Net worth, Asset classes) so the plan can tell what
          you can reach.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '340px minmax(0, 1fr)' },
          gap: { xs: 2, md: 3 },
          alignItems: 'start'
        }}
      >
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Group title="Where you start">
              <Field label="Cash" value={cash} onChange={setCash} auto={auto.cash} step={500} />
              <Field label="Funds you could sell" value={funds} onChange={setFunds} auto={auto.funds} step={1000} />
              <Field
                label="Pensions"
                value={pensions}
                onChange={setPensions}
                auto={auto.pensions}
                step={1000}
                helper="Locked, so counted at the end but not toward what you can reach."
              />
            </Group>

            <Group title="Spending">
              <Field label="Spending a month" value={spending} onChange={setSpending} auto={auto.spending} step={50} />
              <Field
                label="Travel and one-offs a year"
                value={extraYearly}
                onChange={setExtraYearly}
                step={500}
                helper="On top of the monthly figure."
              />
            </Group>

            <Group title="Income">
              <Field label="Take-home a month now" value={takeHomeNow} onChange={setTakeHomeNow} auto={auto.takeHome} step={50} />
              <Field
                label="Income ends"
                type="date"
                value={incomeEnds}
                onChange={setIncomeEnds}
                helper="Leave empty if it carries on."
              />
              {endsValid && (
                <>
                  <Field label="Months with no income" value={gapMonths} onChange={setGapMonths} step={1} />
                  <Field
                    label="Take-home a month after"
                    value={takeHomeAfter}
                    onChange={setTakeHomeAfter}
                    auto={takeNow}
                    step={100}
                    helper="Include any part-time work."
                  />
                </>
              )}
              <Field
                label="Into pensions a month"
                value={pensionContribution}
                onChange={setPensionContribution}
                step={50}
                helper="Out of take-home, while there is income."
              />
            </Group>

            <Group title="The plan">
              <Field label="Cash to keep, in months" value={bufferMonths} onChange={setBufferMonths} step={1} />
              <Field label="Years to look ahead" value={years} onChange={setYears} step={1} min={1} />
              <Field
                label="Lived on each year, % of funds"
                value={withdrawal}
                onChange={setWithdrawal}
                step={0.1}
                helper={`Sets the independence target: ${formatCurrency(
                  inputs.withdrawalRatePct > 0
                    ? (inputs.spending * 12 + inputs.extraYearly) / (inputs.withdrawalRatePct / 100)
                    : 0
                )}`}
              />
            </Group>

            <Group title="Returns, after inflation">
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                <Field label="Cautious %" value={low} onChange={setLow} step={0.5} min={-10} />
                <Field label="Base %" value={mid} onChange={setMid} step={0.5} min={-10} />
                <Field label="Optimistic %" value={high} onChange={setHigh} step={0.5} min={-10} />
              </Box>
              <Field
                label="Yearly swings, %"
                value={volatility}
                onChange={setVolatility}
                step={1}
                helper="How far a year can stray from the average. Drives the range and the chances."
              />
            </Group>

            <Button size="small" onClick={reset} sx={{ alignSelf: 'flex-start', mt: 1 }}>
              Reset to my data
            </Button>
          </CardContent>
        </Card>

        <PlanResults
          inputs={inputs}
          scenarios={scenarios}
          random={random}
          volatilityPct={vol}
          whatIf={whatIf}
          startYear={today.getFullYear()}
          incomeEnds={endsValid}
        />
      </Box>
    </Box>
  );
};

export default PlanSection;
